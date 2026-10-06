package com.anilist.server.anime.sync;

import com.anilist.server.anime.repository.AnimeRepository;
import com.anilist.server.anime.service.AnimeCache;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.global.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CatalogServiceTest {
    private final AniListClient client = mock(AniListClient.class);
    private final TranslationService translations = mock(TranslationService.class);
    private final DocumentStore store = mock(DocumentStore.class);
    private final MongoTemplate mongo = mock(MongoTemplate.class);
    private final AnimeCache cache = mock(AnimeCache.class);
    private final AnimeCatalogService service = new AnimeCatalogService(client, translations, store, mongo, mock(AnimeRepository.class), cache);
    private final ObjectMapper json = new ObjectMapper();
    @Test void doesNotDeactivateCatalogWhenLaterPageFails() throws Exception {
        when(client.request(anyString(), anyMap())).thenReturn(json.readTree("{\"Page\":{\"media\":[],\"pageInfo\":{\"hasNextPage\":true}}}"))
                .thenThrow(new ApiException(502, "upstream unavailable"));
        assertThatThrownBy(() -> service.sync("genre", "SUMMER", 2026, true)).isInstanceOf(ApiException.class);
        verifyNoInteractions(mongo);
        verify(cache).invalidate();
    }
    @Test void preservesReviewedTitleAndDoesNotReplaceWholeDocument() throws Exception {
        when(store.find(eq("animes"), any())).thenReturn(new Document("title", "이전 제목")
                .append("localization", new Document("title", "검증된 제목")));
        when(translations.translate(anyString(), anyString())).thenAnswer(call -> call.getArgument(0));
        service.persist(json.readTree("{\"id\":1,\"title\":{\"native\":\"Changed\"},\"description\":\"<p>줄거리</p>\"}"), "genre");
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(store).update(eq("animes"), any(Query.class), update.capture(), eq(true));
        Document set = update.getValue().getUpdateObject().get("$set", Document.class);
        assertThat(set.getString("title")).isEqualTo("검증된 제목");
        assertThat(set).doesNotContainKeys("localization", "_id", "contentTypes");
        assertThat(set.getBoolean("isCatalogActive")).isTrue();
    }
    @Test void treatsMixedJapaneseKoreanAsUntranslated() {
        assertThat(TranslationService.needsTranslation("한국어 日本語")).isTrue();
        assertThat(TranslationService.needsTranslation("한국어 제목")).isFalse();
        assertThat(TranslationService.needsTranslation("English title")).isTrue();
    }
}
