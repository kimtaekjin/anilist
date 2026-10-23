package com.anilist.server.anime.localization;

import com.anilist.server.anime.sync.TranslationService;
import com.anilist.server.anime.service.AnimeCache;
import com.anilist.server.global.data.DocumentStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClients;
import de.bwaldvogel.mongo.MongoServer;
import de.bwaldvogel.mongo.backend.memory.MemoryBackend;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import java.util.*;
import java.nio.file.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

class FieldLedgerBenchmark {
    private double percentile(List<Double> values, double p) {
        var list = new ArrayList<>(values);Collections.sort(list);return list.get((int)Math.ceil(list.size()*p)-1);
    }
    @Test void measureLedger() throws Exception {
        MongoServer server = new MongoServer(new MemoryBackend());
        try (var client = MongoClients.create(server.bindAndGetConnectionString())) {
            MongoTemplate mongo = new MongoTemplate(client, "bench");
            mongo.insert(new Document("_id",1),"animes");
            TranslationService translation = mock(TranslationService.class);
            when(translation.configurationRevision()).thenReturn("test-revision");
            when(translation.translate(anyString(),eq("synopsis"))).thenReturn("한국어 번역");
            var localization = new AnimeLocalizationService(new DocumentStore(mongo), translation, mock(AnimeCache.class));
            for (int i=0;i<20;i++) localization.translate(1,"synopsis","description","Warmup "+i,"synopsis","");
            clearInvocations(translation);
            List<Double> changed = new ArrayList<>(), unchanged = new ArrayList<>();
            for (int i=0;i<50;i++) {
                long start = System.nanoTime();
                assertThat(localization.translate(1,"synopsis","description","Changed "+i,"synopsis","")).isEqualTo("한국어 번역");
                changed.add((System.nanoTime()-start)/1e6);
            }
            verify(translation,times(50)).translate(anyString(),eq("synopsis"));
            clearInvocations(translation);
            for (int i=0;i<200;i++) {
                long start = System.nanoTime();
                assertThat(localization.translate(1,"synopsis","description","Changed 49","synopsis","")).isEqualTo("한국어 번역");
                unchanged.add((System.nanoTime()-start)/1e6);
            }
            verify(translation,never()).translate(anyString(),anyString());
            var output = Map.of("storage","mongo-java-server in-memory via MongoDB protocol; not production MongoDB",
                    "translation","mock returns immediately; no inference/Redis",
                    "changed", Map.of("samples",50,"p50_ms",percentile(changed,.5),"p95_ms",percentile(changed,.95),"translation_calls",50),
                    "unchanged",Map.of("samples",200,"p50_ms",percentile(unchanged,.5),"p95_ms",percentile(unchanged,.95),"translation_calls",0));
            Files.writeString(Path.of(System.getenv("LEDGER_OUTPUT")),new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(output));
        } finally { server.shutdownNow(); }
    }
}
