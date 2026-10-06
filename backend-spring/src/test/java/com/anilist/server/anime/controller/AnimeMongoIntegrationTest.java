package com.anilist.server.anime.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Opt-in, read-only verification against the configured existing catalog. */
@SpringBootTest(properties = {"app.initialize-indexes=false", "app.sync.enabled=false", "app.redis-enabled=false"})
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "ANIME_MONGO_INTEGRATION", matches = "true")
class AnimeMongoIntegrationTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private com.anilist.server.anime.sync.AnimeCatalogService catalog;

    @org.junit.jupiter.api.BeforeEach
    void disableExternalWrites() {
        org.mockito.Mockito.when(catalog.localize(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.when(catalog.fetchDetail(org.mockito.ArgumentMatchers.anyInt()))
                .thenThrow(new com.anilist.server.global.exception.ApiException(503, "Read-only integration test"));
    }

    @Test
    void readsHomeListAndDetailFromExistingMongoCatalog() throws Exception {
        String body = mockMvc.perform(get("/service/anime/home").param("limit", "2"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode home = objectMapper.readTree(body);
        assertThat(home.get("trending").size()).isBetween(1, 2);
        assertThat(home.get("completed").isArray()).isTrue();
        assertThat(home.get("ova").isArray()).isTrue();
        int id = home.get("trending").get(0).get("_id").asInt();
        mockMvc.perform(get("/service/anime/trending").param("limit", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0]._id").value(id));
        mockMvc.perform(get("/service/anime/detail/{id}", id))
                .andExpect(status().isOk()).andExpect(jsonPath("$._id").value(id));
    }
}
