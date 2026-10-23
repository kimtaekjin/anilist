package com.anilist.server.anime.localization;

import com.anilist.server.anime.sync.TranslationService;
import com.anilist.server.anime.service.AnimeCache;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.user.UserService;
import org.bson.Document;
import org.springframework.stereotype.Service;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.query.Update;
import java.util.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/** Field-level durable translation ledger. Source text is never replaced by its translation. */
@Service
public class AnimeLocalizationService {
    private final DocumentStore store;
    private final TranslationService translations;
    private final AnimeCache cache;
    public AnimeLocalizationService(DocumentStore store, TranslationService translations, AnimeCache cache) {
        this.store = store; this.translations = translations; this.cache = cache;
    }
    public String translate(int animeId, String field, String targetPath, String source, String domain, String previous) {
        source = Objects.toString(source, "").trim();
        String hash = UserService.sha256(source);
        String revision = translations.configurationRevision();
        String statePath = "localization.fields." + field;
        Document anime = store.find("animes", query(where("_id").is(animeId)));
        Document localization = anime == null ? null : anime.get("localization", Document.class);
        Document fields = localization == null ? null : localization.get("fields", Document.class);
        Document state = fields == null ? null : fields.get(field, Document.class);
        if (state != null && "manual".equals(state.getString("status")))
            return Objects.toString(state.getString("translatedText"), previous);
        if (state != null && hash.equals(state.getString("sourceHash"))
                && "completed".equals(state.getString("status")))
            return state.getString("translatedText");
        String jobId = animeId + ":" + field + ":" + hash + ":" + revision;
        Document job = store.find("animeLocalizationJobs", query(where("_id").is(jobId)));
        if (state == null || !hash.equals(state.getString("sourceHash"))) {
            Document next = new Document("source", source).append("sourceHash", hash)
                    .append("status", "pending").append("configurationRevision", revision)
                    .append("preferredModel", translations.configuredModel()).append("promptVersion", translations.configuredPromptVersion());
            store.update("animes", query(where("_id").is(animeId)), new Update().set(statePath, next), false);
        }
        if (job == null) {
            Update create = new Update().setOnInsert("animeId", animeId).setOnInsert("field", field)
                    .setOnInsert("targetPath", targetPath).setOnInsert("source", source).setOnInsert("sourceHash", hash)
                    .setOnInsert("domain", domain).setOnInsert("configurationRevision", revision)
                    .setOnInsert("status", "pending").setOnInsert("attempts", 0)
                    .setOnInsert("nextRetryAt", new Date()).setOnInsert("createdAt", new Date());
            try { store.update("animeLocalizationJobs", query(where("_id").is(jobId)), create, true); }
            catch (DuplicateKeyException concurrent) { /* Another instance created the same job. */ }
        }
        if (job != null && "completed".equals(job.getString("status"))) {
            String result = job.getString("translatedText");
            Document restored = store.update("animes", query(where("_id").is(animeId).and(statePath + ".sourceHash").is(hash)
                            .and(statePath + ".status").ne("manual")),
                    new Update().set(targetPath, result).set(statePath + ".status", "completed")
                            .set(statePath + ".translatedText", result).set(statePath + ".translatedAt", new Date()), false);
            if (restored != null) cache.invalidate();
            return result;
        }
        process(jobId);
        Document latest = store.find("animeLocalizationJobs", query(where("_id").is(jobId)));
        if (latest != null && "completed".equals(latest.getString("status"))) return latest.getString("translatedText");
        // Another owner may still be translating. The caller must not publish this source.
        // Never substitute a translation of an older source for a changed source.
        return source;
    }
    public void process(String jobId) {
        Date now = new Date();
        String owner = UUID.randomUUID().toString();
        var available = new org.springframework.data.mongodb.core.query.Criteria().orOperator(
                where("status").in("pending", "failed").and("nextRetryAt").lte(now),
                where("status").is("processing").and("leaseUntil").lte(now));
        Document job = store.update("animeLocalizationJobs", query(where("_id").is(jobId).andOperator(available)),
                new Update().set("status", "processing").set("owner", owner)
                        .set("configurationRevision", translations.configurationRevision())
                        .set("leaseUntil", new Date(now.getTime() + 300000)).inc("attempts", 1), false);
        if (job == null) return;
        String statePath = "localization.fields." + job.getString("field");
        String source = job.getString("source");
        Document current = store.find("animes", query(where("_id").is(job.getInteger("animeId"))));
        Document meta = current == null ? null : current.get("localization", Document.class);
        Document fields = meta == null ? null : meta.get("fields", Document.class);
        Document state = fields == null ? null : fields.get(job.getString("field"), Document.class);
        if (("title".equals(job.getString("field")) && (protectedTitle(current)
                || (meta != null && meta.getString("title") != null && !meta.getString("title").isBlank()))) || current == null
                || state == null || !job.getString("sourceHash").equals(state.getString("sourceHash"))
                || "manual".equals(state.getString("status"))) {
            store.update("animeLocalizationJobs", query(where("_id").is(jobId).and("owner").is(owner)),
                    new Update().set("status", "superseded"), false);
            return;
        }
        store.update("animes", query(where("_id").is(job.getInteger("animeId"))
                        .and(statePath + ".sourceHash").is(job.getString("sourceHash"))
                        .and(statePath + ".status").ne("manual")),
                new Update().set(statePath + ".owner", owner).set(statePath + ".status", "processing"), false);
        try {
            String result = translations.translate(source, job.getString("domain"));
            boolean complete = result != null && (source.isBlank() || !result.isBlank()) && !TranslationService.needsTranslation(result);
            if (!complete) { fail(job, owner, "TRANSLATION_UNAVAILABLE_OR_INVALID"); return; }
            // Lease ownership and source hashes prevent stale workers from committing newer fields.
            Document owned = store.find("animeLocalizationJobs", query(where("_id").is(jobId).and("owner").is(owner)
                    .and("status").is("processing").and("leaseUntil").gt(new Date())));
            if (owned == null) return;
            var target = query(where("_id").is(job.getInteger("animeId"))
                    .and(statePath + ".sourceHash").is(job.getString("sourceHash"))
                    .and(statePath + ".owner").is(owner).and(statePath + ".status").ne("manual"));
            if ("title".equals(job.getString("field"))) {
                target.addCriteria(where("localization.titleStatus").nin("manual", "verified", "approved"));
                target.addCriteria(where("localization.titleSource").ne("official"));
                target.addCriteria(new org.springframework.data.mongodb.core.query.Criteria().orOperator(
                        where("localization.title").exists(false), where("localization.title").is(null), where("localization.title").is("")));
            }
            store.update("animes", target, new Update().set(statePath + ".status", "completed")
                    .set(statePath + ".translatedText", result).set(statePath + ".translatedAt", new Date())
                    .set(statePath + ".configurationRevision", job.getString("configurationRevision"))
                    .set(statePath + ".preferredModel", translations.configuredModel())
                    .set(statePath + ".promptVersion", translations.configuredPromptVersion()), false);
            String path = job.getString("targetPath");
            if (path.startsWith("characters.")) {
                String[] parts = path.split("\\.");
                String field = job.getString("field");
                if (!field.contains("index_")) target.addCriteria(where("characters." + parts[1] + ".anilistId")
                        .is(Integer.parseInt(field.substring("character_".length()))));
            }
            Document updated = store.update("animes", target, new Update().set(path, result)
                    .set(statePath + ".status", "completed").set(statePath + ".translatedText", result)
                    .set(statePath + ".translatedAt", new Date())
                    .set(statePath + ".configurationRevision", job.getString("configurationRevision"))
                    .set(statePath + ".preferredModel", translations.configuredModel())
                    .set(statePath + ".promptVersion", translations.configuredPromptVersion()), false);
            store.update("animeLocalizationJobs", query(where("_id").is(jobId).and("owner").is(owner).and("status").is("processing")),
                    new Update().set("status", "completed").set("translatedText", result).set("completedAt", new Date()), false);
            if (updated != null) cache.invalidate();
        } catch (RuntimeException failure) { fail(job, owner, "TRANSLATION_REQUEST_FAILED"); }
    }
    private void fail(Document job, String owner, String code) {
        int attempts = job.getInteger("attempts", 1);
        long delay = Math.min(3600000L, 30000L * (1L << Math.min(attempts - 1, 7)));
        store.update("animeLocalizationJobs", query(where("_id").is(job.getString("_id")).and("owner").is(owner)
                        .and("status").is("processing")),
                new Update().set("status", "failed").set("lastErrorCode", code)
                        .set("nextRetryAt", new Date(System.currentTimeMillis() + delay)), false);
        store.update("animes", query(where("_id").is(job.getInteger("animeId"))
                        .and("localization.fields." + job.getString("field") + ".sourceHash").is(job.getString("sourceHash"))
                        .and("localization.fields." + job.getString("field") + ".status").is("processing")
                        .and("localization.fields." + job.getString("field") + ".owner").is(owner)),
                new Update().set("localization.fields." + job.getString("field") + ".status", "failed")
                        .set("localization.fields." + job.getString("field") + ".lastErrorCode", code), false);
    }
    public static boolean protectedTitle(Document anime) {
        Document localization = anime == null ? null : anime.get("localization", Document.class);
        if (localization == null) return false;
        return Set.of("manual", "verified", "approved").contains(Objects.toString(localization.getString("titleStatus"), ""))
                || "official".equals(localization.getString("titleSource"));
    }
}
