package com.anilist.server.anime.sync;

import com.anilist.server.anime.service.AnimeReadService;
import org.junit.jupiter.api.Test;
import java.util.Set;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CatalogJobsTest {
    @Test
    void skipsOverlappingRunsInsideOneJvm() throws Exception {
        AnimeCatalogService catalog = mock(AnimeCatalogService.class);
        AnimeReadService reads = mock(AnimeReadService.class);
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        when(catalog.sync(anyString(), anyString(), anyInt(), anyBoolean())).thenAnswer(invocation -> {
            calls.incrementAndGet(); entered.countDown(); release.await(2, TimeUnit.SECONDS); return 0;
        });
        CatalogJobs jobs = new CatalogJobs(catalog, reads, true, 0, 0);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        Future<?> first = executor.submit(jobs::sync);
        assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
        Future<?> second = executor.submit(jobs::sync);
        second.get(2, TimeUnit.SECONDS);
        release.countDown();
        first.get(3, TimeUnit.SECONDS);
        executor.shutdownNow();
        assertThat(calls.get()).isEqualTo(9);
        assertThat(jobs.isRunning()).isFalse();
    }

    @Test
    void disabledScheduledInvocationDoesNothing() {
        AnimeCatalogService catalog = mock(AnimeCatalogService.class);
        CatalogJobs jobs = new CatalogJobs(catalog, mock(AnimeReadService.class), false, 0, 0);
        jobs.scheduled();
        verifyNoInteractions(catalog);
    }
}
