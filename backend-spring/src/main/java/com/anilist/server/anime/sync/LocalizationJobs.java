package com.anilist.server.anime.sync;

import com.anilist.server.anime.service.AnimeCache;
import com.anilist.server.global.data.DocumentStore;
import com.fasterxml.jackson.databind.JsonNode;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.*;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.Duration;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Component
public class LocalizationJobs implements ApplicationRunner {
    private static final int STARTUP_WIKIDATA_LIMIT = 100;
    private static final Logger log = LoggerFactory.getLogger(LocalizationJobs.class);
    private final DocumentStore store;
    private final ExternalJsonClient http;
    private final TranslationService translations;
    private final AnimeCache cache;
    private final AnimeCatalogService catalog;
    private final long itemIntervalMs;
    private final boolean localizeKoOnStartup;
    private final ExecutorService startupExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "localize-ko-startup");
        thread.setDaemon(true);
        return thread;
    });
    public LocalizationJobs(DocumentStore store, ExternalJsonClient http, TranslationService translations,
                            AnimeCache cache, AnimeCatalogService catalog,
                            @org.springframework.beans.factory.annotation.Value("${LOCALIZE_ITEM_INTERVAL_MS:5000}") long itemIntervalMs,
                            @org.springframework.beans.factory.annotation.Value("${LOCALIZE_KO_ON_STARTUP:true}") boolean localizeKoOnStartup) {
        this.store = store; this.http = http; this.translations = translations; this.cache = cache; this.catalog = catalog;
        this.itemIntervalMs = Math.max(0, itemIntervalMs);
        this.localizeKoOnStartup = localizeKoOnStartup;
    }
    @Override public void run(ApplicationArguments args) {
        String rawArgs = String.join(" ", args.getSourceArgs());
        boolean apply = rawArgs.contains("--apply");
        int limit = optionInt(args, "limit", 0);
        if (rawArgs.contains("--localize-ko")) wikidata(apply);
        if (rawArgs.contains("--repair-titles")) repair(apply);
        if (rawArgs.contains("--localize-all")) localizeAll(apply, limit);
        if (rawArgs.contains("--random-anime")) randomAnime(optionInt(args, "random-anime", 100));
        boolean explicitJob = rawArgs.contains("--localize-ko") || rawArgs.contains("--repair-titles")
                || rawArgs.contains("--localize-all") || rawArgs.contains("--random-anime")
                || rawArgs.contains("--catalog-sync") || rawArgs.contains("--catalog-backfill");
        if (localizeKoOnStartup && !explicitJob) {
            startupExecutor.submit(() -> {
                try {
                    log.info("Startup Korean title localization started");
                    wikidata(true, STARTUP_WIKIDATA_LIMIT);
                    log.info("Startup Korean title localization completed");
                } catch (RuntimeException failure) {
                    log.warn("Startup Korean title localization failed: {}", failure.getMessage());
                }
            });
        }
    }

    @jakarta.annotation.PreDestroy
    void shutdownStartupExecutor() { startupExecutor.shutdownNow(); }

    public void localizeAll(boolean apply) {
        localizeAll(apply, 0);
    }

    public void localizeAll(boolean apply, int limit) {
        List<Document> anime = store.list("animes", new Query().with(Sort.by("_id")));
        if (limit > 0 && anime.size() > limit) anime = new ArrayList<>(anime.subList(0, limit));
        int processed = 0;
        try {
            for (Document row : anime) {
                if (apply) {
                    catalog.localizeStored(((Number) row.get("_id")).intValue());
                    processed++;
                    if (processed % 100 == 0) log.info("Localization attempts: {}/{} (apply=true)", processed, anime.size());
                    pauseBetweenItems();
                    continue;
                }
                String description = Objects.toString(row.getString("description"), "");
                String translatedDescription = translations.translate(description, "synopsis");
                List<Document> characters = row.getList("characters", Document.class);
                if (characters == null) characters = List.of();
                List<String> names = characters.stream().map(character -> {
                    Document name = character.get("name", Document.class);
                    return name == null ? "" : Objects.toString(name.getString("native"), "");
                }).toList();
                List<String> translatedNames = translations.translateCharacters(names);
                List<Document> translatedCharacters = new ArrayList<>();
                for (int i = 0; i < characters.size(); i++) {
                    Document character = new Document(characters.get(i));
                    Document name = character.get("name", Document.class);
                    if (name != null) character.put("name", new Document(name).append("native", translatedNames.get(i)));
                    translatedCharacters.add(character);
                }
                if (!description.equals(translatedDescription) || !characters.equals(translatedCharacters))
                    log.debug("Localization preview: animeId={} changesAvailable=true", row.get("_id"));
                processed++;
                if (processed % 100 == 0) log.info("Localization progress: {}/{} processed (apply={})", processed, anime.size(), apply);
                pauseBetweenItems();
            }
        } finally { if (apply) cache.invalidate(); }
        log.info("Localization complete: {} processed (apply={})", processed, apply);
    }

    private void pauseBetweenItems() {
        if (itemIntervalMs <= 0) return;
        try {
            Thread.sleep(itemIntervalMs);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Localization job interrupted", interrupted);
        }
    }

    private int optionInt(ApplicationArguments args, String name, int fallback) {
        if (!args.containsOption(name)) return fallback;
        try { return Math.max(0, Integer.parseInt(args.getOptionValues(name).getFirst())); }
        catch (RuntimeException ignored) { return fallback; }
    }

    /** Fetches random AniList details and only persists IDs not already in MongoDB. */
    public void randomAnime(int target) {
        int wanted = Math.max(1, Math.min(target, 100));
        int inserted = 0, skipped = 0, failed = 0, attempts = 0;
        Random random = new Random();
        Set<Integer> tried = new HashSet<>();
        long started = System.nanoTime();
        while (inserted < wanted && attempts < wanted * 20) {
            int id = 1 + random.nextInt(200_000);
            if (!tried.add(id)) continue;
            attempts++;
            if (store.find("animes", query(where("_id").is(id))) != null) { skipped++; continue; }
            try {
                catalog.fetchDetail(id);
                inserted++;
                log.info("Random anime localization progress: {}/{} inserted, {} skipped, {} failed",
                        inserted, wanted, skipped, failed);
            } catch (RuntimeException failure) {
                failed++;
                log.debug("Random anime candidate unavailable: id={} reason={}", id, failure.getMessage());
            }
        }
        cache.invalidate();
        double seconds = (System.nanoTime() - started) / 1_000_000_000.0;
        log.info("Random anime localization complete: inserted={} skipped={} failed={} attempts={} durationSeconds={}",
                inserted, skipped, failed, attempts, String.format(Locale.ROOT, "%.2f", seconds));
    }
    public void wikidata(boolean apply) {
        wikidata(apply, 0);
    }
    private void wikidata(boolean apply, int maxItems) {
        List<Document> anime = store.list("animes", query(where("seasonYear").gte(2000)).with(Sort.by("_id")))
                .stream().filter(candidate -> !recentlyReviewed(candidate)).toList();
        if (maxItems > 0 && anime.size() > maxItems) anime = anime.subList(0, maxItems);
        try {
            for (int offset = 0; offset < anime.size(); offset += 100) {
                List<Document> batch = anime.subList(offset, Math.min(offset + 100, anime.size()));
                String values = batch.stream().map(d -> "\"" + ((Number)d.get("_id")).intValue() + "\"").collect(Collectors.joining(" "));
                String sparql = "SELECT ?anilistId ?item ?koLabel ?koArticle WHERE { VALUES ?anilistId { " + values
                        + " } ?item wdt:P8729 ?anilistId. OPTIONAL { ?item rdfs:label ?koLabel FILTER(LANG(?koLabel) = \"ko\") }"
                        + " OPTIONAL { ?koArticle schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. } }";
                JsonNode rows = http.get("https://query.wikidata.org/sparql?format=json&query=" + URLEncoder.encode(sparql, StandardCharsets.UTF_8), Duration.ofSeconds(15))
                        .path("results").path("bindings");
                Set<Integer> matchedIds = new HashSet<>();
                for (JsonNode row : rows) {
                    int id = row.path("anilistId").path("value").asInt();
                    Document old = batch.stream().filter(d -> ((Number)d.get("_id")).intValue() == id).findFirst().orElse(null);
                    String title = row.path("koLabel").path("value").asText("").replaceAll("\\s+\\(애니메이션\\)$", "").trim();
                    String article = row.path("koArticle").path("value").asText("");
                    if (old == null || com.anilist.server.anime.localization.AnimeLocalizationService.protectedTitle(old)) continue;
                    matchedIds.add(id);
                    if (title.isBlank() || title.equals(old.getString("title"))) {
                        if (apply) store.update("animes", query(where("_id").is(id)), new Update()
                                .set("localization.titleReviewedAt", new Date()), false);
                        continue;
                    }
                    String sourceUrl = row.path("item").path("value").asText("");
                    if (article.isBlank()) {
                        log.info("Korean title auto-selection {}: {} -> {} (confidence=0.9, apply={})", id, old.getString("title"), title, apply);
                        if (apply) store.update("animes", query(where("_id").is(id)), new Update()
                                .set("title", title)
                                .set("localization.title", title)
                                .set("localization.titleSource", "wikidata-ko")
                                .set("localization.titleSourceUrl", sourceUrl)
                                .set("localization.titleConfidence", 0.9)
                                .set("localization.titleStatus", "auto-approved")
                                .set("localization.selectedSource", "wikidata-ko")
                                .set("localization.selectionReason", "AniList ID와 Wikidata 항목이 직접 연결되고 한국어 label이 존재함")
                                .set("localization.titleReviewedAt", new Date()), false);
                    } else {
                        log.info("Korean title {}: {} -> {} (confidence=1.0, apply={})", id, old.getString("title"), title, apply);
                        if (apply) store.update("animes", query(where("_id").is(id)), new Update().set("title", title)
                                .set("localization.title", title).set("localization.titleSource", "wikidata-ko")
                                .set("localization.titleSourceUrl", sourceUrl)
                                .set("localization.titleConfidence", 1.0)
                                .set("localization.titleStatus", "auto-approved")
                                .set("localization.selectedSource", "wikidata-wikipedia")
                                .set("localization.selectionReason", "AniList ID 직접 연결과 한국어 Wikipedia 문서가 모두 확인됨")
                                .set("localization.titleReviewedAt", new Date()).set("localization.koreanArticleUrl", article), false);
                    }
                }
                if (apply) {
                    for (Document old : batch) {
                        int id = ((Number) old.get("_id")).intValue();
                        if (!matchedIds.contains(id)) {
                            store.update("animes", query(where("_id").is(id)),
                                    new Update().set("localization.titleReviewedAt", new Date()), false);
                        }
                    }
                }
                ExternalJsonClient.pause(250);
            }
        } finally { if (apply) cache.invalidate(); }
    }
    public void repair(boolean apply) {
        try {
            for (Document anime : store.list("animes", new Query())) {
                if (com.anilist.server.anime.localization.AnimeLocalizationService.protectedTitle(anime)) continue;
                String title = Objects.toString(anime.getString("title"), "");
                if (title.matches("(?s).*[가-힣].*") || !title.matches("(?s).*[\\u3040-\\u30ff\\u3400-\\u9fff].*")) continue;
                Document original = anime.get("originalTitle", Document.class);
                String source = original == null ? title : Objects.toString(original.getString("native"), title);
                String translated = apply ? catalog.repairTitle(((Number) anime.get("_id")).intValue(), source, title)
                        : translations.translate(source, "title");
                if (TranslationService.needsTranslation(translated)) continue;
                log.info("Title repair {}: {} -> {} (apply={})", anime.get("_id"), title, translated, apply);
                if (apply) store.update("animes", query(where("_id").is(anime.get("_id"))), new Update().set("title", translated), false);
            }
        } finally { if (apply) cache.invalidate(); }
    }
    private boolean recentlyReviewed(Document anime) {
        Document localization = anime.get("localization", Document.class);
        Object value = localization == null ? null : localization.get("titleReviewedAt");
        if (!(value instanceof Date reviewedAt)) return false;
        String status = Objects.toString(anime.getString("status"), "");
        long days = "RELEASING".equalsIgnoreCase(status) ? 7 : 90;
        return reviewedAt.toInstant().isAfter(Instant.now().minus(days, ChronoUnit.DAYS));
    }
}
