package com.anilist.server.anime.sync;

import com.anilist.server.global.cache.RedisStore;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.user.UserService;
import org.bson.Document;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Update;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class TranslationService {
    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);
    private static final Map<String, String> GENRES = Map.ofEntries(
            Map.entry("Action", "액션"), Map.entry("Adventure", "모험"), Map.entry("Comedy", "코미디"),
            Map.entry("Drama", "드라마"), Map.entry("Fantasy", "판타지"), Map.entry("Horror", "호러"),
            Map.entry("Mystery", "미스터리"), Map.entry("Romance", "로맨스"), Map.entry("Sci-Fi", "SF"),
            Map.entry("Slice of Life", "일상"), Map.entry("Sports", "스포츠"), Map.entry("Supernatural", "초자연"),
            Map.entry("Suspense", "서스펜스"), Map.entry("Ecchi", "에치"), Map.entry("Gourmet", "미식"),
            Map.entry("Award Winning", "수상작"), Map.entry("Avant Garde", "아방가르드"));
    private final DocumentStore store; private final RedisStore redis; private final ExternalJsonClient http;
    private final String key, endpoint, geminiKey, geminiModel; private final long interval; private long nextRequest, cooldown;
    public TranslationService(DocumentStore store, RedisStore redis, ExternalJsonClient http,
            @Value("${translationAPI:}") String key, @Value("${TRANSLATION_ENDPOINT:}") String endpoint,
            @Value("${GEMINI_API_KEY:}") String geminiKey, @Value("${GEMINI_MODEL:gemini-3.8-flash}") String geminiModel,
            @Value("${TRANSLATION_REQUEST_INTERVAL_MS:1500}") long interval) {
        this.store = store; this.redis = redis; this.http = http; this.key = key; this.geminiKey = geminiKey; this.geminiModel = geminiModel;
        this.interval = Math.max(0, interval);
        this.endpoint = endpoint.isBlank() ? "https://translation.googleapis.com/language/translate/v2" : endpoint;
    }
    private static boolean hasKorean(String text) { return text != null && text.codePoints().anyMatch(c -> c >= 0xAC00 && c <= 0xD7A3); }
    private static boolean hasJapaneseOrCjk(String text) { return text != null && text.matches("(?s).*[\\u3040-\\u30ff\\u3400-\\u9fff].*"); }
    public static boolean needsTranslation(String text) {
        if (text == null || text.isBlank()) return false;
        return hasJapaneseOrCjk(text) || (!hasKorean(text) && text.matches("(?s).*[A-Za-z].*"));
    }
    public String genre(String value) { return GENRES.containsKey(value) ? GENRES.get(value) : translate(value, "general"); }

    public synchronized List<String> translateCharacters(List<String> names) {
        if (names == null || names.isEmpty()) return List.of();
        List<String> results = new java.util.ArrayList<>(names);
        List<String> missing = new java.util.ArrayList<>();
        List<Integer> indexes = new java.util.ArrayList<>();
        for (int i = 0; i < names.size(); i++) {
            String name = names.get(i) == null ? "" : names.get(i).trim();
            String translated = translateCharacterCached(name);
            results.set(i, translated);
            if (translated.equals(name) && !name.isBlank()) { missing.add(name); indexes.add(i); }
        }
        if (missing.isEmpty() || geminiKey.isBlank()) return results;
        try {
            ExternalJsonClient.pause(nextRequest - System.currentTimeMillis());
            nextRequest = System.currentTimeMillis() + interval;
            String prompt = "다음은 일본 애니메이션 캐릭터 이름 목록입니다. 각 이름을 한국에서 통용되는 고유명사처럼 자연스럽게 음역하세요. "
                    + "반드시 입력과 같은 순서의 JSON 문자열 배열만 반환하세요.\n입력: " + new ObjectMapper().writeValueAsString(missing);
            Map<String, Object> body = Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel
                    + ":generateContent?key=" + java.net.URLEncoder.encode(geminiKey, java.nio.charset.StandardCharsets.UTF_8);
            var response = http.post(url, body, Map.of());
            if (response.status() != 200) return results;
            String raw = response.body().path("candidates").path(0).path("content").path("parts").path(0).path("text").asText("")
                    .trim().replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
            JsonNode translated = new ObjectMapper().readTree(raw);
            for (int i = 0; i < indexes.size() && i < translated.size(); i++) {
                String value = translated.path(i).asText(missing.get(i)).trim();
                results.set(indexes.get(i), value);
                saveCharacterTranslation(missing.get(i), value);
            }
        } catch (Exception failure) { log.warn("Gemini character batch translation failed: {}", failure.getMessage()); }
        return results;
    }

    private String translateCharacterCached(String text) {
        if (!needsTranslation(text)) return text;
        String source = hasJapaneseOrCjk(text) ? "ja" : "en";
        String cacheKey = "translation:gemini:character:" + UserService.sha256(source + ":ko:" + text);
        String cached = redis.get(cacheKey); if (cached != null && !cached.equals(text)) return cached;
        var lookup = query(where("provider").is("gemini-character").and("originalText").is(text)
                .and("sourceLang").is(source).and("targetLang").is("ko"));
        Document saved = store.find("translations", lookup);
        if (saved != null && saved.getString("translatedText") != null
                && !text.equals(saved.getString("translatedText"))) {
            cached = saved.getString("translatedText");
            redis.put(cacheKey, cached, Duration.ofDays(1));
            return cached;
        }
        return text;
    }

    private void saveCharacterTranslation(String text, String translated) {
        if (translated.isBlank() || translated.equals(text)) return;
        String source = hasJapaneseOrCjk(text) ? "ja" : "en";
        var lookup = query(where("provider").is("gemini-character").and("originalText").is(text)
                .and("sourceLang").is(source).and("targetLang").is("ko"));
        store.update("translations", lookup, new Update().set("translatedText", translated).set("updatedAt", new Date()).setOnInsert("createdAt", new Date()), true);
        redis.put("translation:gemini:character:" + UserService.sha256(source + ":ko:" + text), translated, Duration.ofDays(1));
    }
    public synchronized String translate(String input, String domain) {
        if (input == null) return "";
        String text = input.trim(); if (!needsTranslation(text)) return text;
        if (domain.equals("character")) return translateCharacter(text);
        String source = hasJapaneseOrCjk(text) ? "ja" : "en";
        String provider = domain.equals("general") ? "google" : "google-" + domain;
        String cacheKey = "translation:google:" + UserService.sha256(domain + ":" + source + ":ko:" + text);
        String cached = redis.get(cacheKey); if (cached != null && !cached.equals(text)) return cached;
        var lookup = query(where("provider").is(provider).and("originalText").is(text).and("sourceLang").is(source).and("targetLang").is("ko"));
        Document saved = store.find("translations", lookup);
        if (saved != null && saved.getString("translatedText") != null && !text.equals(saved.getString("translatedText"))) {
            cached = saved.getString("translatedText"); redis.put(cacheKey, cached, Duration.ofDays(1)); return cached;
        }
        if (key.isBlank() || System.currentTimeMillis() < cooldown) return text;
        ExternalJsonClient.pause(nextRequest - System.currentTimeMillis()); nextRequest = System.currentTimeMillis() + interval;
        try {
            Map<String, Object> body = Map.of("q", List.of(text), "source", source, "target", "ko", "format", "text");
            var response = http.post(endpoint + "?key=" + java.net.URLEncoder.encode(key, java.nio.charset.StandardCharsets.UTF_8), body, Map.of());
            if (response.status() == 429 || response.status() == 403) { cooldown = System.currentTimeMillis() + 60000; return text; }
            if (response.status() != 200) return text;
            String translated = response.body().path("data").path("translations").path(0)
                    .path("translatedText").asText(text).trim();
            if (!translated.isBlank() && !translated.equals(text)) {
                store.update("translations", lookup, new Update().set("translatedText", translated).set("updatedAt", new Date()).setOnInsert("createdAt", new Date()), true);
                redis.put(cacheKey, translated, Duration.ofDays(1));
            }
            return translated;
        } catch (RuntimeException failure) { return text; }
    }

    private String translateCharacter(String text) {
        String source = hasJapaneseOrCjk(text) ? "ja" : "en";
        String provider = "gemini-character";
        String cacheKey = "translation:gemini:character:" + UserService.sha256(source + ":ko:" + text);
        String cached = redis.get(cacheKey); if (cached != null && !cached.equals(text)) return cached;
        var lookup = query(where("provider").is(provider).and("originalText").is(text)
                .and("sourceLang").is(source).and("targetLang").is("ko"));
        Document saved = store.find("translations", lookup);
        if (saved != null && saved.getString("translatedText") != null && !text.equals(saved.getString("translatedText"))) {
            cached = saved.getString("translatedText"); redis.put(cacheKey, cached, Duration.ofDays(1)); return cached;
        }
        if (geminiKey.isBlank()) {
            log.warn("Gemini character translation skipped: GEMINI_API_KEY is blank");
            return text;
        }
        try {
            String prompt = "다음은 일본 애니메이션 캐릭터 이름입니다. 일반 단어로 직역하지 말고, "
                    + "한국에서 통용되는 고유명사처럼 자연스럽게 음역하세요. 설명 없이 번역 결과만 반환하세요.\n\n원문: " + text;
            Map<String, Object> body = Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))));
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel
                    + ":generateContent?key=" + java.net.URLEncoder.encode(geminiKey, java.nio.charset.StandardCharsets.UTF_8);
            var response = http.post(url, body, Map.of());
            if (response.status() != 200) {
                log.warn("Gemini character translation failed: status={} model={} response={}",
                        response.status(), geminiModel, response.body().toString().substring(0, Math.min(300, response.body().toString().length())));
                return text;
            }
            String translated = response.body().path("candidates").path(0).path("content").path("parts").path(0)
                    .path("text").asText(text).trim().replaceAll("^[`\\s]+|[`\\s]+$", "");
            if (!translated.isBlank() && !translated.equals(text)) {
                store.update("translations", lookup, new Update().set("translatedText", translated).set("updatedAt", new Date()).setOnInsert("createdAt", new Date()), true);
                redis.put(cacheKey, translated, Duration.ofDays(1));
            }
            return translated;
        } catch (RuntimeException failure) {
            log.warn("Gemini character translation request error: model={} message={}", geminiModel, failure.getMessage());
            return text;
        }
    }
}
