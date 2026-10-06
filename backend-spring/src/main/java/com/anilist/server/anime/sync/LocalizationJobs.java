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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Component
public class LocalizationJobs implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(LocalizationJobs.class);
    private final DocumentStore store;
    private final ExternalJsonClient http;
    private final TranslationService translations;
    private final AnimeCache cache;
    public LocalizationJobs(DocumentStore store, ExternalJsonClient http, TranslationService translations, AnimeCache cache) {
        this.store = store; this.http = http; this.translations = translations; this.cache = cache;
    }
    @Override public void run(ApplicationArguments args) {
        String rawArgs = String.join(" ", args.getSourceArgs());
        boolean apply = rawArgs.contains("--apply");
        if (rawArgs.contains("--localize-ko")) wikidata(apply);
        if (rawArgs.contains("--repair-titles")) repair(apply);
        if (rawArgs.contains("--localize-all")) localizeAll(apply);
    }

    public void localizeAll(boolean apply) {
        List<Document> anime = store.list("animes", new Query().with(Sort.by("_id")));
        int processed = 0, updated = 0;
        try {
            for (Document row : anime) {
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
                if (apply && (!description.equals(translatedDescription) || !characters.equals(translatedCharacters))) {
                    store.update("animes", query(where("_id").is(row.get("_id"))),
                            new Update().set("description", translatedDescription).set("characters", translatedCharacters), false);
                    updated++;
                }
                processed++;
                if (processed % 100 == 0) log.info("Localization progress: {}/{} processed, {} updated (apply={})", processed, anime.size(), updated, apply);
            }
        } finally { if (apply) cache.invalidate(); }
        log.info("Localization complete: {} processed, {} updated (apply={})", processed, updated, apply);
    }
    public void wikidata(boolean apply) {
        List<Document> anime = store.list("animes", query(where("seasonYear").gte(2000)).with(Sort.by("_id")));
        try {
            for (int offset = 0; offset < anime.size(); offset += 100) {
                List<Document> batch = anime.subList(offset, Math.min(offset + 100, anime.size()));
                String values = batch.stream().map(d -> "\"" + ((Number)d.get("_id")).intValue() + "\"").collect(Collectors.joining(" "));
                String sparql = "SELECT ?anilistId ?item ?koLabel ?koArticle WHERE { VALUES ?anilistId { " + values
                        + " } ?item wdt:P8729 ?anilistId. OPTIONAL { ?item rdfs:label ?koLabel FILTER(LANG(?koLabel) = \"ko\") }"
                        + " OPTIONAL { ?koArticle schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>. } }";
                JsonNode rows = http.get("https://query.wikidata.org/sparql?format=json&query=" + URLEncoder.encode(sparql, StandardCharsets.UTF_8))
                        .path("results").path("bindings");
                for (JsonNode row : rows) {
                    int id = row.path("anilistId").path("value").asInt();
                    Document old = batch.stream().filter(d -> ((Number)d.get("_id")).intValue() == id).findFirst().orElse(null);
                    String title = row.path("koLabel").path("value").asText("").replaceAll("\\s+\\(애니메이션\\)$", "").trim();
                    String article = row.path("koArticle").path("value").asText("");
                    if (old == null || title.isBlank() || title.equals(old.getString("title"))) continue;
                    if (article.isBlank() && Objects.toString(old.getString("title"), "").matches("(?s).*[가-힣].*")) continue;
                    log.info("Korean title {}: {} -> {} (apply={})", id, old.getString("title"), title, apply);
                    if (apply) store.update("animes", query(where("_id").is(id)), new Update().set("title", title)
                            .set("localization.title", title).set("localization.titleSource", "wikidata-ko")
                            .set("localization.titleSourceUrl", row.path("item").path("value").asText(""))
                            .set("localization.titleConfidence", article.isBlank() ? 0.9 : 1.0)
                            .set("localization.titleReviewedAt", new Date()).set("localization.koreanArticleUrl", article), false);
                }
                ExternalJsonClient.pause(250);
            }
        } finally { if (apply) cache.invalidate(); }
    }
    public void repair(boolean apply) {
        try {
            for (Document anime : store.list("animes", new Query())) {
                String title = Objects.toString(anime.getString("title"), "");
                if (title.matches("(?s).*[가-힣].*") || !title.matches("(?s).*[\\u3040-\\u30ff\\u3400-\\u9fff].*")) continue;
                Document original = anime.get("originalTitle", Document.class);
                String source = original == null ? title : Objects.toString(original.getString("native"), title);
                String translated = translations.translate(source, "title");
                if (TranslationService.needsTranslation(translated)) continue;
                log.info("Title repair {}: {} -> {} (apply={})", anime.get("_id"), title, translated, apply);
                if (apply) store.update("animes", query(where("_id").is(anime.get("_id"))), new Update().set("title", translated), false);
            }
        } finally { if (apply) cache.invalidate(); }
    }
}
