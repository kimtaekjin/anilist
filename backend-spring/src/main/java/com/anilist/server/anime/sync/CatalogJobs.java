package com.anilist.server.anime.sync;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class CatalogJobs implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(CatalogJobs.class);
    private static final List<String> SEASONS = List.of("WINTER", "SPRING", "SUMMER", "FALL");
    private final AnimeCatalogService catalog;
    private final com.anilist.server.anime.service.AnimeReadService reads;
    private final boolean enabled;
    private final int yearsBack, yearsAhead;
    private final AtomicBoolean running = new AtomicBoolean();
    public CatalogJobs(AnimeCatalogService catalog, com.anilist.server.anime.service.AnimeReadService reads,
                       @Value("${app.sync.enabled:false}") boolean enabled,
                       @Value("${ANIME_GENRE_PRECACHE_YEARS_BACK:5}") int yearsBack,
                       @Value("${ANIME_GENRE_PRECACHE_YEARS_AHEAD:0}") int yearsAhead) {
        this.catalog = catalog; this.reads = reads; this.enabled = enabled; this.yearsBack = yearsBack; this.yearsAhead = yearsAhead;
    }
    @Scheduled(cron="${app.sync.cron:0 0 0 * * *}", zone="Asia/Seoul")
    public void scheduled() {
        if (!enabled) return;
        try { sync(); } catch (RuntimeException failure) { log.error("Catalog sync failed; next scheduled run will retry", failure); }
    }
    public void sync() {
        if (!running.compareAndSet(false, true)) return;
        try {
            LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
            String season = SEASONS.get((today.getMonthValue()-1)/3);
            for (String type : List.of("trending", "airing", "completed", "ova", "upcoming"))
                log.info("Catalog {}: {} records", type, catalog.sync(type, season, today.getYear(), false));
            backfill(today.getYear()-yearsBack, today.getYear()+yearsAhead);
            for (String type : List.of("trending", "airing", "completed", "ova", "upcoming")) reads.findList(type, null, null, null, Set.of());
            reads.findHome("30");
        } finally { running.set(false); }
    }

    boolean isRunning() { return running.get(); }
    public void backfill(int start, int end) {
        if (start < 1900 || end < start || end > 2200) throw new IllegalArgumentException("Invalid backfill year range");
        for (int year = start; year <= end; year++) for (String season : SEASONS)
            log.info("Catalog {} {}: {} records", year, season, catalog.sync("genre", season, year, true));
    }
    @Override public void run(ApplicationArguments args) {
        if (args.containsOption("catalog-sync")) sync();
        if (args.containsOption("catalog-backfill")) {
            int year = LocalDate.now(ZoneId.of("Asia/Seoul")).getYear();
            backfill(argument(args, "start", 2000), argument(args, "end", year));
        }
    }
    private int argument(ApplicationArguments args, String name, int fallback) {
        return args.containsOption(name) ? Integer.parseInt(args.getOptionValues(name).getFirst()) : fallback;
    }
}
