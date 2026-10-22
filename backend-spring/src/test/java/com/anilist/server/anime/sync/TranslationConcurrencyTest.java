package com.anilist.server.anime.sync;

import com.anilist.server.global.cache.RedisStore;
import com.anilist.server.global.data.DocumentStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.query.Query;
import java.time.Duration;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TranslationConcurrencyTest {
    private final DocumentStore store = mock(DocumentStore.class);
    private final RedisStore redis = mock(RedisStore.class);
    private final ExternalJsonClient http = mock(ExternalJsonClient.class);
    private TranslationService service(String model) {
        return new TranslationService(store, redis, http, "", true, "http://localhost:11434/api/generate", model, 5000, 60000);
    }
    @Test void duplicateRequestsShareInferenceAndCachedRequestsDoNotWait() throws Exception {
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        when(http.post(anyString(), any(), anyMap(), any(Duration.class))).thenAnswer(call -> {
            entered.countDown();
            assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
            return new ExternalJsonClient.Result(200, new ObjectMapper().readTree("{\"response\":\"번역문\"}"), "");
        });
        TranslationService service = service("model-a");
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<String> first = executor.submit(() -> service.translate("Hello", "title"));
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
            // A different, already-cached text bypasses the provider lock.
            when(redis.get(anyString())).thenAnswer(call -> {
                // Only the original owner's cache lookup happened before this stub.
                return "캐시 번역";
            });
            assertThat(executor.submit(() -> service.translate("Cached", "title")).get(1, TimeUnit.SECONDS)).isEqualTo("캐시 번역");
            when(redis.get(anyString())).thenReturn(null);
            Future<String> duplicate = executor.submit(() -> service.translate("Hello", "title"));
            assertThatThrownBy(() -> duplicate.get(100, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            release.countDown();
            assertThat(first.get(5, TimeUnit.SECONDS)).isEqualTo("번역문");
            assertThat(duplicate.get(5, TimeUnit.SECONDS)).isEqualTo("번역문");
            verify(http, times(1)).post(anyString(), any(), anyMap(), any(Duration.class));
        } finally { release.countDown(); }
    }
    @Test void mongoIdentitySeparatesModelsAndDoesNotReuseLegacyProvider() {
        service("model-a").translate("Hello", "title");
        service("model-b").translate("Hello", "title");
        var queries = org.mockito.ArgumentCaptor.forClass(Query.class);
        verify(store, atLeast(2)).find(eq("translations"), queries.capture());
        var providers = queries.getAllValues().stream().map(q -> q.getQueryObject().getString("provider"))
                .filter(p -> p.startsWith("local-llm:")).distinct().toList();
        assertThat(providers).hasSize(2).doesNotContain("local-llm-title");
    }
    @Test void failedOllamaRequestsObserveCooldown() {
        when(http.post(anyString(), any(), anyMap(), any(Duration.class))).thenReturn(
                new ExternalJsonClient.Result(503, new ObjectMapper().createObjectNode(), ""));
        TranslationService service = service("model-a");
        assertThat(service.translate("Hello", "title")).isEqualTo("Hello");
        assertThat(service.translate("Other", "title")).isEqualTo("Other");
        verify(http, times(1)).post(anyString(), any(), anyMap(), any(Duration.class));
    }
}
