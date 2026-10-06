package com.anilist.server.anime.service;

import com.anilist.server.global.cache.RedisStore;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.time.Duration;

@Component
public class AnimeCache {
    private final RedisStore redis;
    private final ObjectMapper mapper;
    public AnimeCache(RedisStore redis, ObjectMapper mapper) { this.redis = redis; this.mapper = mapper; }
    // Independent namespace prevents incompatible Node and Spring DTOs sharing a cache entry.
    private String key(String key) { return "spring:anime:v1:" + key; }
    public String generation() { String value = redis.get("spring:anime:generation"); return value == null ? "0" : value; }
    public <T> T get(String key, TypeReference<T> type) {
        try { String value = redis.get(key(key)); return value == null ? null : mapper.readValue(value, type); }
        catch (Exception ignored) { return null; }
    }
    public void put(String key, Object value, long seconds) {
        try { redis.put(key(key), mapper.writeValueAsString(value), Duration.ofSeconds(seconds)); }
        catch (Exception ignored) { }
    }
    public void invalidate() {
        redis.put("spring:anime:generation", java.util.UUID.randomUUID().toString(), Duration.ofDays(3650));
    }
}
