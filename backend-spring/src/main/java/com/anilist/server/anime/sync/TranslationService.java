package com.anilist.server.anime.sync;

import com.anilist.server.global.cache.RedisStore;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.user.UserService;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Map;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class TranslationService {
    private static final Map<String, String> GENRES = Map.ofEntries(
            Map.entry("Action", "액션"), Map.entry("Adventure", "모험"), Map.entry("Comedy", "코미디"),
            Map.entry("Drama", "드라마"), Map.entry("Fantasy", "판타지"), Map.entry("Horror", "공포"),
            Map.entry("Mystery", "미스터리"), Map.entry("Romance", "로맨스"), Map.entry("Sci-Fi", "SF"),
            Map.entry("Slice of Life", "일상"), Map.entry("Sports", "스포츠"), Map.entry("Supernatural", "초자연"),
            Map.entry("Suspense", "서스펜스"), Map.entry("Ecchi", "에치"), Map.entry("Gourmet", "미식"),
            Map.entry("Award Winning", "수상작"), Map.entry("Avant Garde", "아방가르드"));
    private final DocumentStore store; private final RedisStore redis; private final ExternalJsonClient http;
    private final String key, endpoint; private final long interval; private long nextRequest, cooldown;

    public TranslationService(DocumentStore store, RedisStore redis, ExternalJsonClient http,
            @Value("${translationAPI:}") String key, @Value("${TRANSLATION_ENDPOINT:}") String endpoint,
            @Value("${TRANSLATION_REQUEST_INTERVAL_MS:1500}") long interval) {
        this.store = store; this.redis = redis; this.http = http; this.key = key;
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
        return names.stream().map(name -> translate(name == null ? "" : name.trim(), "character")).toList();
    }
    public synchronized String translate(String input, String domain) {
        if (input == null) return "";
        String text = input.trim(); if (!needsTranslation(text)) return text;
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
            var response = http.post(endpoint + "?key=" + URLEncoder.encode(key, StandardCharsets.UTF_8), body, Map.of());
            if (response.status() == 429 || response.status() == 403) { cooldown = System.currentTimeMillis() + 60000; return text; }
            if (response.status() != 200) return text;
            String translated = response.body().path("data").path("translations").path(0).path("translatedText").asText(text).trim();
            if (!translated.isBlank() && !translated.equals(text)) {
                store.update("translations", lookup, new Update().set("translatedText", translated).set("updatedAt", new Date()).setOnInsert("createdAt", new Date()), true);
                redis.put(cacheKey, translated, Duration.ofDays(1));
            }
            return translated;
        } catch (RuntimeException failure) { return text; }
    }
}
