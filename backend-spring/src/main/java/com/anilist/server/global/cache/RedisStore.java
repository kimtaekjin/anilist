package com.anilist.server.global.cache;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

/** Redis is optional: connection failures fall back to the primary database. */
@Component
public class RedisStore {
    private final StringRedisTemplate redis;
    private final boolean enabled;
    public RedisStore(StringRedisTemplate redis, @Value("${app.redis-enabled:false}") boolean enabled) {
        this.redis = redis;
        this.enabled = enabled;
    }
    public String get(String key) {
        if (!enabled) return null;
        try { return redis.opsForValue().get(key); } catch (RuntimeException ignored) { return null; }
    }
    public void put(String key, String value, Duration ttl) {
        if (!enabled) return;
        try { redis.opsForValue().set(key, value, ttl); } catch (RuntimeException ignored) { }
    }
    public Optional<Boolean> acquire(String key, String value, Duration ttl) {
        if (!enabled) return Optional.empty();
        try { return Optional.of(Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key, value, ttl))); }
        catch (RuntimeException ignored) { return Optional.empty(); }
    }
    public void delete(String key) {
        if (!enabled) return;
        try { redis.delete(key); } catch (RuntimeException ignored) { }
    }
    public Long consume(String key, Duration window) {
        if (!enabled) return null;
        try {
            return redis.execute(new DefaultRedisScript<>(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return n",
                    Long.class), List.of(key), Long.toString(window.toMillis()));
        } catch (RuntimeException ignored) { return null; }
    }
}
