package com.anilist.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AnilistApplication {

    public static void main(String[] args) {
        String rawArgs = String.join(" ", args);
        boolean job = java.util.Set.of("--catalog-sync", "--catalog-backfill", "--localize-ko", "--repair-titles", "--localize-all")
                .stream().anyMatch(rawArgs::contains);
        SpringApplication application = new SpringApplication(AnilistApplication.class);
        if (job) {
            application.setWebApplicationType(org.springframework.boot.WebApplicationType.NONE);
            try (var context = application.run(args)) { /* ApplicationRunner executes the requested job. */ }
        } else application.run(args);
    }
}
