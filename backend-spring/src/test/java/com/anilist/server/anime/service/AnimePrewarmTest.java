package com.anilist.server.anime.service;

import com.anilist.server.anime.dto.*;
import com.anilist.server.anime.sync.AnimeCatalogService;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AnimePrewarmTest {
    @Test void repeatedListsDoNotDuplicatePendingWorkAndQueueIsBounded() throws Exception {
        AnimeService anime = mock(AnimeService.class);
        AnimeReadService reads = spy(new AnimeReadService(anime, mock(AnimeCache.class), mock(AnimeCatalogService.class), 60, 60, 60, true));
        CountDownLatch entered = new CountDownLatch(2), release = new CountDownLatch(1);
        doAnswer(call -> {
            entered.countDown();
            release.await(5, TimeUnit.SECONDS);
            return null;
        }).when(reads).findDetail(anyInt());
        List<AnimeListResponse> items = IntStream.rangeClosed(1, 150).mapToObj(id -> {
            AnimeListResponse item = mock(AnimeListResponse.class);
            when(item.id()).thenReturn(id);
            return item;
        }).toList();
        when(anime.findHome("30")).thenReturn(new AnimeHomeResponse(items, items, items));
        try {
            reads.findHome("30");
            assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
            reads.findHome("30");
            var field = AnimeReadService.class.getDeclaredField("detailPreloader");
            field.setAccessible(true);
            var executor = (ThreadPoolExecutor) field.get(reads);
            assertThat(executor.getQueue()).hasSize(100);
            verify(reads, times(1)).findDetail(1);
            verify(reads, times(1)).findDetail(2);
            // Home returns while inference remains blocked; caller never runs rejected work.
            assertThat(release.getCount()).isEqualTo(1);
        } finally { reads.shutdownPreloader(); release.countDown(); }
    }
}
