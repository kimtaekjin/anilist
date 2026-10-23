package com.anilist.server.anime.service;

import com.anilist.server.anime.dto.AnimeDetailResponse;
import com.anilist.server.anime.domain.AnimeDocument;
import com.anilist.server.anime.sync.AnimeCatalogService;
import com.anilist.server.global.exception.ApiException;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;

class KoreanReadinessTest {
    @Test void untranslatedDetailIsNotReturnedOrCachedAsSuccess() {
        AnimeService anime = mock(AnimeService.class);
        AnimeCache cache = mock(AnimeCache.class);
        AnimeCatalogService catalog = mock(AnimeCatalogService.class);
        AnimeDetailResponse detail = mock(AnimeDetailResponse.class);
        when(detail.title()).thenReturn("Original title");
        when(detail.description()).thenReturn("Original synopsis");
        when(detail.image()).thenReturn(new AnimeDocument.Image("image", "image", ""));
        when(anime.findDetail(1)).thenReturn(detail);
        when(catalog.localize(detail)).thenReturn(detail);
        AnimeReadService reads = new AnimeReadService(anime, cache, catalog, 60, 60, 60, false);
        try {
            assertThatThrownBy(() -> reads.findDetail(1)).isInstanceOfSatisfying(ApiException.class,
                    error -> assertThat(error.status()).isEqualTo(503));
            verify(cache, never()).put(anyString(), any(), anyLong());
        } finally { reads.shutdownPreloader(); }
    }
    @Test void readinessIncludesCharactersAndGenres() {
        AnimeDetailResponse detail = mock(AnimeDetailResponse.class);
        when(detail.title()).thenReturn("한국어 제목");
        when(detail.description()).thenReturn("한국어 줄거리");
        when(detail.genres()).thenReturn(List.of("Action"));
        assertThat(AnimeReadService.ready(detail)).isFalse();
        when(detail.genres()).thenReturn(List.of("액션"));
        when(detail.characters()).thenReturn(List.of(new AnimeDocument.AnimeCharacter(1, "MAIN",
                new AnimeDocument.CharacterName("Name", "Original"), null)));
        assertThat(AnimeReadService.ready(detail)).isFalse();
        when(detail.characters()).thenReturn(List.of(new AnimeDocument.AnimeCharacter(1, "MAIN",
                new AnimeDocument.CharacterName("Name", "한국 이름"), null)));
        assertThat(AnimeReadService.ready(detail)).isTrue();
    }
}
