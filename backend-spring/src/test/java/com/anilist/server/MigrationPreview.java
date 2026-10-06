package com.anilist.server;

import com.anilist.server.anime.sync.ExternalJsonClient;
import com.anilist.server.user.ResetMailer;
import de.bwaldvogel.mongo.MongoServer;
import de.bwaldvogel.mongo.backend.memory.MemoryBackend;
import org.bson.Document;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.core.MongoTemplate;
import java.time.LocalDate;
import java.util.*;

/** Local browser verification only. Never packaged in the production bootJar. */
public class MigrationPreview {
    public static void main(String[] args) {
        MongoServer database = new MongoServer(new MemoryBackend());
        String uri = database.bindAndGetConnectionString() + "/preview";
        Runtime.getRuntime().addShutdownHook(new Thread(database::shutdownNow));
        var app = new SpringApplication(AnilistApplication.class, PreviewConfiguration.class);
        var context = app.run("--server.port=8081", "--spring.data.mongodb.uri=" + uri,
                "--app.jwt-secret=preview-only-secret-at-least-32-bytes-long", "--app.redis-enabled=false",
                "--app.sync.enabled=false", "--app.environment=development", "--app.client-url=http://localhost:3000");
        MongoTemplate mongo = context.getBean(MongoTemplate.class);
        for (int id = 1; id <= 8; id++) {
            mongo.getCollection("animes").insertOne(new Document("_id", id).append("title", "스프링 테스트 애니 " + id)
                    .append("type", "TV").append("description", "스프링 백엔드의 상세 조회를 검증하기 위한 테스트 작품입니다.")
                    .append("originalTitle", new Document("romaji", "Preview " + id).append("native", "테스트 작품"))
                    .append("image", new Document("large", "http://localhost:3000/logo192.png").append("extraLarge", "http://localhost:3000/logo192.png"))
                    .append("genres", List.of("액션")).append("studio", List.of("테스트 제작사"))
                    .append("season", "SUMMER").append("seasonYear", LocalDate.now().getYear()).append("status", "FINISHED")
                    .append("episodes", 12).append("averageScore", 80 + id).append("popularity", 10000-id)
                    .append("startDate", new Document("year", 2026).append("month", 7).append("day", 1))
                    .append("characters", List.of()).append("contentTypes", id <= 3 ? List.of("trending", "completed", "genre") : List.of("completed", "ova", "genre"))
                    .append("isCatalogActive", true));
        }
        System.out.println("MIGRATION_PREVIEW_READY http://localhost:8081 (isolated in-memory database)");
    }
    @TestConfiguration
    static class PreviewConfiguration {
        @Bean @Primary ExternalJsonClient previewExternal() { return org.mockito.Mockito.mock(ExternalJsonClient.class, invocation -> { throw new IllegalStateException("External calls disabled in preview"); }); }
        @Bean @Primary ResetMailer previewMailer() { return org.mockito.Mockito.mock(ResetMailer.class); }
    }
}
