package com.anilist.server.anime.sync;

import com.anilist.server.global.exception.ApiException;
import com.anilist.server.global.cache.RedisStore;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.util.Map;

@Component
public class AniListClient {
    private final ExternalJsonClient http;
    private final RedisStore redis;
    private final long interval;
    private final int retries;
    private long nextRequest;
    public AniListClient(ExternalJsonClient http, RedisStore redis,
                         @Value("${ANILIST_MIN_REQUEST_INTERVAL_MS:2200}") long interval,
                         @Value("${ANILIST_MAX_RETRIES:5}") int retries) {
        this.http = http; this.redis = redis; this.interval = Math.max(1, interval); this.retries = Math.max(0, retries);
    }
    public synchronized JsonNode request(String query, Map<String, Object> variables) {
        for (int attempt = 0; attempt <= retries; attempt++) {
            ExternalJsonClient.pause(nextRequest - System.currentTimeMillis());
            while (!redis.acquire("lock:anilist:request-slot", "spring", Duration.ofMillis(interval)).orElse(true))
                ExternalJsonClient.pause(interval);
            nextRequest = System.currentTimeMillis() + interval;
            ExternalJsonClient.Result response;
            try { response = http.post("https://graphql.anilist.co", Map.of("query", query, "variables", variables), Map.of()); }
            catch (RuntimeException failure) {
                if (attempt == retries || Thread.currentThread().isInterrupted()) throw new ApiException(502, "AniList 연결에 실패했습니다.");
                nextRequest = System.currentTimeMillis() + Math.min(30000, 1000L << Math.min(attempt, 5)); continue;
            }
            JsonNode errors = response.body().path("errors");
            int status = errors.isArray() && !errors.isEmpty() ? errors.get(0).path("status").asInt(502) : response.status();
            if (status >= 200 && status < 300 && (errors.isMissingNode() || errors.isNull() || errors.isEmpty())) return response.body().path("data");
            if ((status == 429 || status >= 500) && attempt < retries) {
                long delay = Math.min(60000, 3000L << Math.min(attempt, 5));
                try { delay = Math.max(delay, Long.parseLong(response.retryAfter()) * 1000); } catch (NumberFormatException ignored) { }
                delay = Math.min(delay, 300000);
                redis.put("lock:anilist:request-slot", "cooldown", Duration.ofMillis(delay));
                nextRequest = System.currentTimeMillis() + delay; continue;
            }
            throw new ApiException(status == 404 ? 404 : 502, "AniList 데이터를 가져오지 못했습니다.");
        }
        throw new ApiException(502, "AniList 데이터를 가져오지 못했습니다.");
    }
}
