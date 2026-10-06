package com.anilist.server.global;

import com.anilist.server.global.cache.RedisStore;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import java.time.Duration;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RedisStoreTest {
    @Test void redisOutageDoesNotBreakPrimaryReadsOrViewCounting() {
        StringRedisTemplate template = mock(StringRedisTemplate.class);
        when(template.opsForValue()).thenThrow(new IllegalStateException("offline"));
        RedisStore store = new RedisStore(template, true);
        assertThat(store.get("key")).isNull();
        assertThat(store.acquire("key", "value", Duration.ofSeconds(1))).isEmpty();
        assertThatCode(() -> store.put("key", "value", Duration.ofSeconds(1))).doesNotThrowAnyException();
    }
}
