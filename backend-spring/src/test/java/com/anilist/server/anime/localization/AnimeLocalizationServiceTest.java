package com.anilist.server.anime.localization;

import com.anilist.server.anime.sync.TranslationService;
import com.anilist.server.anime.service.AnimeCache;
import com.anilist.server.global.data.DocumentStore;
import com.mongodb.client.MongoClients;
import de.bwaldvogel.mongo.MongoServer;
import de.bwaldvogel.mongo.backend.memory.MemoryBackend;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.data.mongodb.core.query.Query.query;
import static org.springframework.data.mongodb.core.query.Criteria.where;

class AnimeLocalizationServiceTest {
    MongoServer server;
    com.mongodb.client.MongoClient client;
    MongoTemplate mongo;
    DocumentStore store;
    TranslationService translations;
    AnimeLocalizationService service;
    @BeforeEach void setup() {
        server = new MongoServer(new MemoryBackend());
        client = MongoClients.create(server.bindAndGetConnectionString());
        mongo = new MongoTemplate(client, "localization_test");
        store = new DocumentStore(mongo);
        translations = mock(TranslationService.class);
        when(translations.configurationRevision()).thenReturn("revision-a");
        service = new AnimeLocalizationService(store, translations, mock(AnimeCache.class));
        mongo.insert(new Document("_id", 1), "animes");
    }
    @AfterEach void cleanup() { client.close(); server.shutdownNow(); }
    String translate(String source) { return service.translate(1, "synopsis", "description", source, "synopsis", ""); }
    Document anime() { return store.find("animes", query(where("_id").is(1))); }
    Document job() { return mongo.findAll(Document.class, "animeLocalizationJobs").getFirst(); }
    @Test void unchangedSourceReusesTranslationButChangedSourceRetranslates() {
        when(translations.translate("First", "synopsis")).thenReturn("첫 줄거리");
        when(translations.translate("Changed", "synopsis")).thenReturn("바뀐 줄거리");
        assertThat(translate("First")).isEqualTo("첫 줄거리");
        when(translations.configurationRevision()).thenReturn("revision-b");
        assertThat(translate("First")).isEqualTo("첫 줄거리");
        verify(translations, times(1)).translate("First", "synopsis");
        assertThat(translate("Changed")).isEqualTo("바뀐 줄거리");
        Document state = anime().get("localization", Document.class).get("fields", Document.class).get("synopsis", Document.class);
        assertThat(state.getString("source")).isEqualTo("Changed");
        assertThat(state.getString("status")).isEqualTo("completed");
        assertThat(anime().getString("description")).isEqualTo("바뀐 줄거리");
    }
    @Test void failedFieldSurvivesRestartAndRetriesOnlyWhenDue() {
        when(translations.translate("First", "synopsis")).thenReturn("First");
        assertThat(translate("First")).isEqualTo("First");
        assertThat(job().getString("status")).isEqualTo("failed");
        translate("First");
        verify(translations, times(1)).translate("First", "synopsis");
        store.update("animeLocalizationJobs", query(where("_id").is(job().getString("_id"))),
                new Update().set("nextRetryAt", new Date(0)), false);
        when(translations.translate("First", "synopsis")).thenReturn("복구한 번역");
        var restarted = new AnimeLocalizationService(store, translations, mock(AnimeCache.class));
        new LocalizationRetryWorker(store, restarted).retry();
        assertThat(job().getString("status")).isEqualTo("completed");
        assertThat(job().getInteger("attempts")).isEqualTo(2);
        assertThat(anime().getString("description")).isEqualTo("복구한 번역");
    }
    @Test void expiredLeaseIsRecovered() {
        when(translations.translate("First", "synopsis")).thenReturn("First");
        translate("First");
        store.update("animeLocalizationJobs", query(where("_id").is(job().getString("_id"))),
                new Update().set("status", "processing").set("leaseUntil", new Date(0)), false);
        when(translations.translate("First", "synopsis")).thenReturn("회복");
        new LocalizationRetryWorker(store, service).retry();
        assertThat(anime().getString("description")).isEqualTo("회복");
    }
    @Test void concurrentRequestsClaimOnlyOneJob() throws Exception {
        CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        when(translations.translate("First", "synopsis")).thenAnswer(call -> {
            entered.countDown(); release.await(3, TimeUnit.SECONDS); return "번역";
        });
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<String> first = executor.submit(() -> translate("First"));
            assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
            assertThat(translate("First")).isEqualTo("First");
            release.countDown();
            assertThat(first.get(3, TimeUnit.SECONDS)).isEqualTo("번역");
            verify(translations, times(1)).translate("First", "synopsis");
        } finally { release.countDown(); }
    }
    @Test void obsoleteSourceJobsCannotOverwriteNewerTranslation() {
        when(translations.translate("First", "synopsis")).thenReturn("First");
        translate("First");
        String oldId = job().getString("_id");
        when(translations.translate("Changed", "synopsis")).thenReturn("새 줄거리");
        translate("Changed");
        store.update("animeLocalizationJobs", query(where("_id").is(oldId)),
                new Update().set("nextRetryAt", new Date(0)), false);
        service.process(oldId);
        assertThat(anime().getString("description")).isEqualTo("새 줄거리");
        assertThat(store.find("animeLocalizationJobs", query(where("_id").is(oldId))).getString("status")).isEqualTo("superseded");
        verify(translations, times(1)).translate("First", "synopsis");
    }
    @Test void returningToPreviouslyCompletedSourceRestoresItsResult() {
        when(translations.translate("First", "synopsis")).thenReturn("첫 줄거리");
        when(translations.translate("Changed", "synopsis")).thenReturn("새 줄거리");
        translate("First"); translate("Changed");
        assertThat(translate("First")).isEqualTo("첫 줄거리");
        assertThat(anime().getString("description")).isEqualTo("첫 줄거리");
        verify(translations, times(1)).translate("First", "synopsis");
    }
    @Test void manualFieldAndTitleProtectionAreHonored() {
        store.update("animes", query(where("_id").is(1)), new Update().set("localization.fields.synopsis",
                new Document("status", "manual").append("translatedText", "수동 번역"))
                .set("localization.titleStatus", "manual"), false);
        assertThat(translate("First")).isEqualTo("수동 번역");
        assertThat(AnimeLocalizationService.protectedTitle(anime())).isTrue();
        verify(translations, never()).translate(anyString(), anyString());
    }
}
