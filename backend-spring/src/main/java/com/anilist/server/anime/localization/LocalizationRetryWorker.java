package com.anilist.server.anime.localization;

import com.anilist.server.global.data.DocumentStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import java.util.Date;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Component
@ConditionalOnProperty(name="app.localization.retry-enabled", havingValue="true")
public class LocalizationRetryWorker {
    private static final Logger log = LoggerFactory.getLogger(LocalizationRetryWorker.class);
    private final DocumentStore store;
    private final AnimeLocalizationService localization;
    public LocalizationRetryWorker(DocumentStore store, AnimeLocalizationService localization) {
        this.store = store; this.localization = localization;
    }
    @Scheduled(fixedDelayString="${app.localization.retry-delay-ms:30000}")
    public void retry() {
        long started = System.nanoTime();
        var due = new org.springframework.data.mongodb.core.query.Criteria().orOperator(
                where("status").in("pending", "failed").and("nextRetryAt").lte(new Date()),
                where("status").is("processing").and("leaseUntil").lte(new Date()));
        var jobs = store.list("animeLocalizationJobs", query(due).with(Sort.by("createdAt")).limit(20));
        for (var job : jobs) {
            try { localization.process(job.getString("_id")); }
            catch (RuntimeException failure) { log.warn("Localization retry failed: id={}", job.getString("_id"), failure); }
        }
        if (!jobs.isEmpty()) log.info("Localization retry batch attempted: count={} durationMs={}", jobs.size(), (System.nanoTime() - started) / 1000000);
    }
}
