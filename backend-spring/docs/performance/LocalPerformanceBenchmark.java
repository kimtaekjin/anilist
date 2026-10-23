package com.anilist.server.anime.sync;

import com.anilist.server.global.cache.RedisStore;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.anime.service.*;
import com.anilist.server.anime.dto.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.lang.management.ManagementFactory;
import java.nio.file.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

class LocalPerformanceBenchmark {
    private static String hotKey(TranslationService service) throws Exception {
        String provider = "local-llm-title";
        try {
            var p = TranslationService.class.getDeclaredMethod("provider", boolean.class, String.class);
            p.setAccessible(true); provider = (String) p.invoke(service, true, "title");
        } catch (NoSuchMethodException legacy) { }
        var method = TranslationService.class.getDeclaredMethod("cacheKey", String.class, String.class, String.class, String.class);
        method.setAccessible(true);
        return (String) method.invoke(service, provider, "title", "en", "Cached");
    }
    private static double percentile(List<Double> values, double p) {
        var sorted = new ArrayList<>(values); Collections.sort(sorted);
        return sorted.get(Math.max(0, (int)Math.ceil(sorted.size()*p)-1));
    }
    @Test void measure() throws Exception {
        RedisStore redis = mock(RedisStore.class);
        ExternalJsonClient http = mock(ExternalJsonClient.class);
        TranslationService translation = new TranslationService(mock(DocumentStore.class), redis, http,
                "", true, "http://unused.invalid", "test-model", 5000, 60000);
        String hot = hotKey(translation);
        when(redis.get(anyString())).thenAnswer(call -> hot.equals(call.getArgument(0)) ? "캐시 번역" : null);
        for (int i=0; i<500; i++) assertThat(translation.translate("Cached", "title")).isEqualTo("캐시 번역");
        AtomicReference<CountDownLatch> entered = new AtomicReference<>();
        when(http.post(anyString(), any(), anyMap(), any(Duration.class))).thenAnswer(call -> {
            entered.get().countDown(); Thread.sleep(200);
            return new ExternalJsonClient.Result(200, new ObjectMapper().readTree("{\"response\":\"한국어 번역\"}"), "");
        });
        List<Double> hotMs = new ArrayList<>(), coldMs = new ArrayList<>();
        try (var executor = Executors.newSingleThreadExecutor()) {
            for (int i=0; i<20; i++) {
                entered.set(new CountDownLatch(1)); final int index = i;
                long coldStart = System.nanoTime();
                Future<String> cold = executor.submit(() -> translation.translate("Cold " + index, "title"));
                assertThat(entered.get().await(5, TimeUnit.SECONDS)).isTrue();
                long start = System.nanoTime();
                assertThat(translation.translate("Cached", "title")).isEqualTo("캐시 번역");
                hotMs.add((System.nanoTime()-start)/1e6);
                assertThat(cold.get(5, TimeUnit.SECONDS)).isEqualTo("한국어 번역");
                coldMs.add((System.nanoTime()-coldStart)/1e6);
            }
        }
        verify(http, times(20)).post(anyString(), any(), anyMap(), any(Duration.class));
        List<Double> submitMs = new ArrayList<>(), cpuMs = new ArrayList<>();
        List<Integer> queues = new ArrayList<>();
        var bean = ManagementFactory.getThreadMXBean();
        for (int trial=0; trial<10; trial++) {
            AnimeService anime = mock(AnimeService.class);
            AnimeReadService reads = spy(new AnimeReadService(anime, mock(AnimeCache.class), mock(AnimeCatalogService.class),60,60,60,true));
            CountDownLatch running = new CountDownLatch(2), release = new CountDownLatch(1);
            doAnswer(call -> { running.countDown(); release.await(10,TimeUnit.SECONDS); return null; }).when(reads).findDetail(anyInt());
            List<AnimeListResponse> items = new ArrayList<>();
            for (int id=1; id<=150; id++) {
                AnimeListResponse item = mock(AnimeListResponse.class);
                when(item.id()).thenReturn(id); when(item.title()).thenReturn("한국어 제목");
                items.add(item);
            }
            when(anime.findHome("30")).thenReturn(new AnimeHomeResponse(items, items, items));
            var field = AnimeReadService.class.getDeclaredField("detailPreloader"); field.setAccessible(true);
            var pool = (ThreadPoolExecutor)field.get(reads);
            try {
                long start = System.nanoTime(), cpu = bean.getCurrentThreadCpuTime();
                for (int i=0;i<20;i++) reads.findHome("30");
                submitMs.add((System.nanoTime()-start)/1e6);
                cpuMs.add((bean.getCurrentThreadCpuTime()-cpu)/1e6);
                assertThat(running.await(2,TimeUnit.SECONDS)).isTrue();
                queues.add(pool.getQueue().size());
            } finally { pool.shutdownNow(); release.countDown(); pool.awaitTermination(5,TimeUnit.SECONDS); }
        }
        String output = new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(Map.of(
                "label", System.getenv("BENCH_LABEL"),
                "cacheHitDuringInference", Map.of("samples",20,"p50_ms",percentile(hotMs,.5),"p95_ms",percentile(hotMs,.95),"raw_ms",hotMs),
                "mockedColdTranslation", Map.of("injected_delay_ms",200,"p50_ms",percentile(coldMs,.5),"p95_ms",percentile(coldMs,.95)),
                "prewarmBurst", Map.of("trials",10,"home_requests",20,"unique_anime",150,"items_per_home",450,
                        "queued",queues,"submission_p50_ms",percentile(submitMs,.5),"submission_p95_ms",percentile(submitMs,.95),
                        "caller_cpu_p50_ms",percentile(cpuMs,.5),"raw_submission_ms",submitMs)));
        Files.writeString(Path.of(System.getenv("BENCH_OUTPUT")), output);
    }
}
