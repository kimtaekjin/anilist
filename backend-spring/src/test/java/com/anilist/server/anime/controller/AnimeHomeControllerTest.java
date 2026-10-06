package com.anilist.server.anime.controller;

import com.anilist.server.anime.domain.AnimeDocument;
import com.anilist.server.anime.repository.AnimeRepository;
import com.anilist.server.anime.service.AnimeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.stream.IntStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AnimeController.class)
@Import({AnimeService.class, com.anilist.server.anime.service.AnimeReadService.class})
class AnimeHomeControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockitoBean private AnimeRepository repository;
    @MockitoBean private com.anilist.server.anime.service.AnimeCache cache;
    @MockitoBean private com.anilist.server.anime.sync.AnimeCatalogService catalog;

    @Test
    void excludesOnlyReturnedTrendingFromCompletedBeforeLimiting() throws Exception {
        when(repository.findByContentType(eq("trending"), any()))
                .thenReturn(List.of(anime(1), anime(2), anime(3)));
        when(repository.findByContentType(eq("completed"), any()))
                .thenReturn(List.of(anime(1), anime(2), anime(3), anime(4)));
        when(repository.findByContentType(eq("ova"), any()))
                .thenReturn(List.of(anime(1), anime(5), anime(6)));

        mockMvc.perform(get("/service/anime/home").param("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trending.length()").value(2))
                .andExpect(jsonPath("$.trending[0]._id").value(1))
                .andExpect(jsonPath("$.trending[0].title").value("Anime 1"))
                .andExpect(jsonPath("$.completed.length()").value(2))
                .andExpect(jsonPath("$.completed[0]._id").value(3))
                .andExpect(jsonPath("$.completed[1]._id").value(4))
                .andExpect(jsonPath("$.ova.length()").value(2))
                .andExpect(jsonPath("$.ova[0]._id").value(1));

        verify(repository).findByContentType("completed",
                Sort.by(Sort.Order.desc("averageScore"), Sort.Order.desc("popularity")));
        verify(repository).findByContentType("trending",
                Sort.by(Sort.Order.desc("popularity"), Sort.Order.desc("averageScore")));
    }

    @ParameterizedTest
    @CsvSource({"2,2", "2.9,2", "99,30", "0,30", "-1,30", "0.5,30", "invalid,30", "NaN,30", "Infinity,30"})
    void preservesHomeLimitBehavior(String limit, int expected) throws Exception {
        when(repository.findByContentType(any(), any()))
                .thenReturn(IntStream.rangeClosed(1, 35).mapToObj(this::anime).toList());
        mockMvc.perform(get("/service/anime/home").param("limit", limit))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trending.length()").value(expected))
                .andExpect(jsonPath("$.ova.length()").value(expected));
    }

    @Test
    void defaultsToThirty() throws Exception {
        when(repository.findByContentType(any(), any()))
                .thenReturn(IntStream.rangeClosed(1, 35).mapToObj(this::anime).toList());
        mockMvc.perform(get("/service/anime/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trending.length()").value(30))
                .andExpect(jsonPath("$.completed.length()").value(5));
    }

    @Test
    void returnsEmptyArraysForEmptyDatabase() throws Exception {
        when(repository.findByContentType(any(), any())).thenReturn(List.of());
        mockMvc.perform(get("/service/anime/home"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"trending\":[],\"completed\":[],\"ova\":[]}"));
    }

    private AnimeDocument anime(int id) {
        return new AnimeDocument(id, null, "TV", "Anime " + id, null, "", null, "", List.of(),
                "", null, "FALL", 2026, 12, "FINISHED", 80, 100, List.of(), null,
                List.of("trending", "completed", "ova"), true, null, List.of());
    }
}
