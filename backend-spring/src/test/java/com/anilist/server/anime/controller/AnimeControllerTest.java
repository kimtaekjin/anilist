package com.anilist.server.anime.controller;

import com.anilist.server.anime.domain.AnimeDocument;
import com.anilist.server.anime.dto.AnimeDetailResponse;
import com.anilist.server.anime.exception.AnimeNotFoundException;
import com.anilist.server.anime.service.AnimeReadService;
import com.anilist.server.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnimeController.class)
@Import(GlobalExceptionHandler.class)
class AnimeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AnimeReadService animeService;

    @Test
    void returnsAnimeDetail() throws Exception {
        AnimeDetailResponse response = new AnimeDetailResponse(
                1, 1, "TV", "카우보이 비밥",
                new AnimeDocument.OriginalTitle("Cowboy Bebop", "Cowboy Bebop", "カウボーイビバップ"),
                "설명", null, "", List.of("액션"),
                "", null, "SPRING", 1998, 26, "FINISHED", 86, 40000, List.of("Sunrise"), null, null, List.of()
        );
        when(animeService.findDetail(1)).thenReturn(response);

        mockMvc.perform(get("/service/anime/detail/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$._id").value(1))
                .andExpect(jsonPath("$.title").value("카우보이 비밥"))
                .andExpect(jsonPath("$.originalTitle.native").value("カウボーイビバップ"));
    }

    @Test
    void returnsNotFoundWhenAnimeDoesNotExist() throws Exception {
        when(animeService.findDetail(999)).thenThrow(new AnimeNotFoundException(999));

        mockMvc.perform(get("/service/anime/detail/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ANIME_NOT_FOUND"));
    }

    @Test
    void returnsAnimeList() throws Exception {
        com.anilist.server.anime.dto.AnimeListResponse item = new com.anilist.server.anime.dto.AnimeListResponse(
                1, 1, "TV", "카우보이 비밥", null, null, "", List.of("액션"), "", null,
                "SPRING", 1998, 26, "FINISHED", 86, 40000, List.of("Sunrise"), null
        );
        when(animeService.findList(eq("trending"), any(), any(), eq(10), any()))
                .thenReturn(List.of(item));

        mockMvc.perform(get("/service/anime/trending").param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]._id").value(1))
                .andExpect(jsonPath("$[0].title").value("카우보이 비밥"));
    }

    @Test
    void returnsBadRequestForUnsupportedListType() throws Exception {
        when(animeService.findList(eq("unknown"), any(), any(), any(), any()))
                .thenThrow(new com.anilist.server.anime.exception.InvalidAnimeQueryException("지원하지 않는 타입"));

        mockMvc.perform(get("/service/anime/unknown"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ANIME_QUERY"));
    }
}
