package com.anilist.server.anime.sync;

import com.anilist.server.global.cache.RedisStore;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.user.UserService;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class TranslationService {
    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);
    private static final String GOOGLE_TRANSLATION_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
    private static final String TRANSLATION_PROMPT_VERSION = "v2";
    private static final long TRANSLATION_REQUEST_INTERVAL_MS = 1500;
    private static final Map<String, String> GENRES = Map.ofEntries(
            Map.entry("Action", "액션"), Map.entry("Adventure", "모험"), Map.entry("Comedy", "코미디"),
            Map.entry("Drama", "드라마"), Map.entry("Fantasy", "판타지"), Map.entry("Horror", "공포"),
            Map.entry("Mystery", "미스터리"), Map.entry("Romance", "로맨스"), Map.entry("Sci-Fi", "SF"),
            Map.entry("Slice of Life", "일상"), Map.entry("Sports", "스포츠"), Map.entry("Supernatural", "초자연"),
            Map.entry("Suspense", "서스펜스"), Map.entry("Ecchi", "에치"), Map.entry("Gourmet", "미식"),
            Map.entry("Award Winning", "수상작"), Map.entry("Avant Garde", "아방가르드"));
    private final DocumentStore store; private final RedisStore redis; private final ExternalJsonClient http;
    private final String key, endpoint, localLlmEndpoint, localLlmModel;
    private final boolean localLlmEnabled;
    private final long localLlmTimeoutMs, localLlmFailureCooldownMs;
    private final long interval; private long nextRequest, cooldown; private volatile long localLlmUnavailableUntil;

    private final Object ollamaLock = new Object();
    private final Object googleLock = new Object();
    private final ConcurrentMap<String, CompletableFuture<String>> inFlight = new ConcurrentHashMap<>();

    public TranslationService(DocumentStore store, RedisStore redis, ExternalJsonClient http,
            @Value("${translationAPI:}") String key,
            @Value("${translation.local-llm.enabled:false}") boolean localLlmEnabled,
            @Value("${translation.local-llm.endpoint:http://localhost:11434/api/generate}") String localLlmEndpoint,
            @Value("${translation.local-llm.model:qwen2.5:7b}") String localLlmModel,
            @Value("${translation.local-llm.timeout-ms:5000}") long localLlmTimeoutMs,
            @Value("${translation.local-llm.failure-cooldown-ms:60000}") long localLlmFailureCooldownMs) {
        this.store = store; this.redis = redis; this.http = http; this.key = key;
        this.interval = TRANSLATION_REQUEST_INTERVAL_MS;
        this.endpoint = GOOGLE_TRANSLATION_ENDPOINT;
        this.localLlmEnabled = localLlmEnabled; this.localLlmEndpoint = localLlmEndpoint; this.localLlmModel = localLlmModel;
        this.localLlmTimeoutMs = Math.max(1000, localLlmTimeoutMs);
        this.localLlmFailureCooldownMs = Math.max(1000, localLlmFailureCooldownMs);
    }
    private static boolean hasKorean(String text) { return text != null && text.codePoints().anyMatch(c -> c >= 0xAC00 && c <= 0xD7A3); }
    private static boolean hasJapaneseOrCjk(String text) { return text != null && text.matches("(?s).*[\\u3040-\\u30ff\\u3400-\\u9fff].*"); }
    public static boolean needsTranslation(String text) {
        if (text == null || text.isBlank()) return false;
        return hasJapaneseOrCjk(text) || (!hasKorean(text) && text.matches("(?s).*[A-Za-z].*"));
    }
    public String genre(String value) { return GENRES.containsKey(value) ? GENRES.get(value) : translate(value, "general"); }
    public List<String> translateCharacters(List<String> names) {
        if (names == null || names.isEmpty()) return List.of();
        return names.stream().map(name -> translate(name == null ? "" : name.trim(), "character")).toList();
    }
    public String translate(String input, String domain) {
        if (input == null) return "";
        String text = input.trim();
        if (!needsTranslation(text)) return text;
        String identity = cacheKey(provider(localLlmEnabled, domain), domain,
                hasJapaneseOrCjk(text) ? "ja" : "en", text);
        CompletableFuture<String> mine = new CompletableFuture<>();
        CompletableFuture<String> existing = inFlight.putIfAbsent(identity, mine);
        if (existing != null) {
            try { return existing.get(localLlmTimeoutMs + 35000, TimeUnit.MILLISECONDS); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); return text; }
            catch (ExecutionException | TimeoutException failure) { return text; }
        }
        try {
            String result = translateUncached(text, domain);
            mine.complete(result);
            return result;
        } catch (RuntimeException | Error failure) {
            mine.completeExceptionally(failure);
            throw failure;
        } finally { inFlight.remove(identity, mine); }
    }

    // Version the provider namespace as well as Redis keys: the existing Mongo unique
    // index remains valid, while legacy/model-specific translations cannot collide.
    private String provider(boolean local, String domain) {
        String base = local ? "local-llm" : "google";
        String revision = local ? TRANSLATION_PROMPT_VERSION + ":" + localLlmModel : "google-v1";
        return base + ":" + domain + ":" + UserService.sha256(revision);
    }

    private String translateUncached(String input, String domain) {
        if (input == null) return "";
        String text = input.trim(); if (!needsTranslation(text)) return text;
        String source = hasJapaneseOrCjk(text) ? "ja" : "en";
        String provider = provider(localLlmEnabled, domain);
        String cacheKey = cacheKey(provider, domain, source, text);
        String cached = redis.get(cacheKey); if (cached != null && !cached.equals(text)) return cached;
        var lookup = query(where("provider").is(provider).and("originalText").is(text).and("sourceLang").is(source).and("targetLang").is("ko"));
        Document saved = store.find("translations", lookup);
        if (saved != null && saved.getString("translatedText") != null && !text.equals(saved.getString("translatedText"))) {
            cached = saved.getString("translatedText"); redis.put(cacheKey, cached, Duration.ofDays(1)); return cached;
        }
        if (localLlmEnabled) {
            log.info("Translation provider request: provider={} domain={} source={} textLength={}", provider, domain, source, text.length());
            String translated = translateWithLocalLlm(text, source, domain);
            if (isValidTranslation(text, translated, domain)) {
                log.info("Translation provider succeeded: provider={} domain={} outputLength={}", provider, domain, translated.length());
                store.update("translations", lookup, new Update().set("translatedText", translated)
                        .set("translationStatus", "auto-approved")
                        .set("translationConfidence", 0.6)
                        .set("model", localLlmModel)
                        .set("updatedAt", new Date()).setOnInsert("createdAt", new Date()), true);
                redis.put(cacheKey, translated, Duration.ofDays(1)); return translated;
            }
            log.warn("Translation provider fallback: provider={} domain={} reason=empty-or-unchanged-response", provider, domain);
            provider = provider(false, domain);
            cacheKey = cacheKey(provider, domain, source, text);
            lookup = query(where("provider").is(provider).and("originalText").is(text)
                    .and("sourceLang").is(source).and("targetLang").is("ko"));
            cached = redis.get(cacheKey);
            if (cached != null && !cached.equals(text)) return cached;
            saved = store.find("translations", lookup);
            if (saved != null && saved.getString("translatedText") != null && !text.equals(saved.getString("translatedText"))) {
                cached = saved.getString("translatedText");
                redis.put(cacheKey, cached, Duration.ofDays(1));
                return cached;
            }
        }
        synchronized (googleLock) {
            return translateWithGoogle(text, source, domain, provider, cacheKey, lookup);
        }
    }

    private String translateWithGoogle(String text, String source, String domain, String provider, String cacheKey,
            org.springframework.data.mongodb.core.query.Query lookup) {
        String cached = redis.get(cacheKey);
        if (cached != null && !cached.equals(text)) return cached;
        Document saved = store.find("translations", lookup);
        if (saved != null && saved.getString("translatedText") != null && !text.equals(saved.getString("translatedText")))
            return saved.getString("translatedText");
        if (key.isBlank() || System.currentTimeMillis() < cooldown) return text;
        ExternalJsonClient.pause(nextRequest - System.currentTimeMillis()); nextRequest = System.currentTimeMillis() + interval;
        try {
            log.info("Translation provider request: provider={} domain={} source={} textLength={}", provider, domain, source, text.length());
            Map<String, Object> body = Map.of("q", List.of(text), "source", source, "target", "ko", "format", "text");
            var response = http.post(endpoint + "?key=" + URLEncoder.encode(key, StandardCharsets.UTF_8), body, Map.of());
            if (response.status() == 429 || response.status() == 403) {
                cooldown = System.currentTimeMillis() + 60000;
                log.warn("Translation provider rate/auth failure: provider={} domain={} status={} cooldownSeconds=60", provider, domain, response.status());
                return text;
            }
            if (response.status() != 200) {
                log.warn("Translation provider HTTP failure: provider={} domain={} status={}", provider, domain, response.status());
                return text;
            }
            String translated = response.body().path("data").path("translations").path(0).path("translatedText").asText(text).trim();
            if (!translated.isBlank() && !translated.equals(text)) {
                store.update("translations", lookup, new Update().set("translatedText", translated)
                        .set("translationStatus", "auto-approved")
                        .set("translationConfidence", 0.5)
                        .set("model", "google-translation")
                        .set("updatedAt", new Date()).setOnInsert("createdAt", new Date()), true);
                redis.put(cacheKey, translated, Duration.ofDays(1));
            }
            log.info("Translation provider succeeded: provider={} domain={} outputLength={}", provider, domain, translated.length());
            return translated;
        } catch (RuntimeException failure) {
            log.warn("Translation provider request failed: provider={} domain={} reason={}", provider, domain, failure.getMessage());
            return text;
        }
    }

    private String translateWithLocalLlm(String text, String source, String domain) {
        synchronized (ollamaLock) { return requestLocalLlm(text, source, domain); }
    }

    private String requestLocalLlm(String text, String source, String domain) {
        if (System.currentTimeMillis() < localLlmUnavailableUntil) return null;
        String prompt = buildPrompt(text, source, domain);
        try {
            Map<String, Object> body = Map.of("model", localLlmModel, "prompt", prompt, "stream", false,
                    "options", Map.of("temperature", 0.1, "num_predict", 1024));
            var response = http.post(localLlmEndpoint, body, Map.of(), Duration.ofMillis(localLlmTimeoutMs));
            if (response.status() != 200) {
                markLocalLlmUnavailable("HTTP " + response.status());
                return null;
            }
            return cleanModelOutput(response.body().path("response").asText(""));
        } catch (RuntimeException failure) {
            markLocalLlmUnavailable(failure.getMessage());
            log.warn("Local LLM translation failed: model={} domain={} reason={}", localLlmModel, domain, failure.getMessage());
            return null;
        }
    }

    private String buildPrompt(String text, String source, String domain) {
        String instruction = switch (domain) {
            case "title" -> "Translate this anime title into natural Korean. Preserve names, numbers, and season markers. Return only the Korean title.";
            case "character" -> "Transliterate this anime character name into Korean. Do not translate the meaning of the name. Return only the Korean name.";
            case "synopsis" -> "Translate this anime synopsis into natural Korean. Do not summarize. Preserve names, places, numbers, and paragraph structure. Return only the translation.";
            default -> "Translate the text into natural Korean. Preserve names and meaning. Return only the translation.";
        };
        return instruction + "\nSource language: " + source + "\nText:\n" + text;
    }

    private String cleanModelOutput(String value) {
        return value == null ? "" : value
                .replaceAll("(?i)^번역 결과\\s*:\\s*", "")
                .replaceAll("^```[a-zA-Z]*\\s*", "")
                .replaceAll("\\s*```$", "")
                .trim();
    }

    private boolean isValidTranslation(String original, String translated, String domain) {
        if (translated == null || translated.isBlank() || translated.equals(original)) return false;
        if (translated.startsWith("번역:") || translated.startsWith("번역 결과:")) return false;
        return !domain.equals("synopsis") || translated.length() <= original.length() * 3 + 500;
    }

    private String cacheKey(String provider, String domain, String source, String text) {
        String input = domain + ":" + source + ":ko:" + text;
        return "translation:" + provider + ":" + UserService.sha256(input);
    }

    private void markLocalLlmUnavailable(String reason) {
        localLlmUnavailableUntil = System.currentTimeMillis() + localLlmFailureCooldownMs;
        log.warn("Ollama temporarily disabled: cooldownMs={} reason={}", localLlmFailureCooldownMs, reason);
    }
}
