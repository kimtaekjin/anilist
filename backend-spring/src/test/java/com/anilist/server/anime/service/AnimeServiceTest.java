package com.anilist.server.anime.service;

import com.anilist.server.anime.domain.AnimeDocument;
import com.anilist.server.anime.dto.AnimeDetailResponse;
import com.anilist.server.anime.exception.AnimeNotFoundException;
import com.anilist.server.anime.repository.AnimeRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

class AnimeServiceTest {

    private final AnimeRepository animeRepository = mock(AnimeRepository.class);
    private final AnimeService animeService = new AnimeService(animeRepository);

    @Test
    void convertsDocumentToDetailResponse() {
        AnimeDocument anime = new AnimeDocument(
                1, 1, "TV", "카우보이 비밥", null, "설명", null, "", List.of("액션"),
                "", null, "SPRING", 1998, 26, "FINISHED", 86, 40000, List.of("Sunrise"), null,
                List.of("completed"), true, null, List.of()
        );
        when(animeRepository.findById(1)).thenReturn(Optional.of(anime));

        AnimeDetailResponse result = animeService.findDetail(1);

        assertThat(result.id()).isEqualTo(1);
        assertThat(result.title()).isEqualTo("카우보이 비밥");
    }

    @Test
    void throwsExceptionWhenAnimeDoesNotExist() {
        when(animeRepository.findById(999)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> animeService.findDetail(999))
                .isInstanceOf(AnimeNotFoundException.class)
                .hasMessageContaining("999");
    }

    @Test
    void filtersExcludedAnimeAndAppliesLimit() {
        AnimeDocument first = anime(1, "첫 번째", 100);
        AnimeDocument second = anime(2, "두 번째", 90);
        AnimeDocument third = anime(3, "세 번째", 80);
        when(animeRepository.findByContentType(eq("trending"), any()))
                .thenReturn(List.of(first, second, third));

        List<com.anilist.server.anime.dto.AnimeListResponse> result = animeService.findList(
                "trending", null, null, 1, Set.of(1)
        );

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().id()).isEqualTo(2);
    }

    @Test
    void rejectsUnsupportedListType() {
        assertThatThrownBy(() -> animeService.findList("unknown", null, null, null, Set.of()))
                .isInstanceOf(com.anilist.server.anime.exception.InvalidAnimeQueryException.class);
    }

    private AnimeDocument anime(int id, String title, int popularity) {
        return new AnimeDocument(
                id, null, "TV", title, null, "", null, "", List.of(), "", null,
                "FALL", 2026, 12, "RELEASING", 80, popularity, List.of(), null,
                List.of("trending"), true, null, List.of()
        );
    }
}
