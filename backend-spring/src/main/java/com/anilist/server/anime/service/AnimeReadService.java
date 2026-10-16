package com.anilist.server.anime.service;

import com.anilist.server.anime.dto.*;
import com.anilist.server.anime.exception.AnimeNotFoundException;
import com.anilist.server.anime.sync.AnimeCatalogService;
import com.anilist.server.anime.sync.TranslationService;
import com.anilist.server.global.exception.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Read-through caching and upstream fallback are separated from list selection rules. */
@Service
public class AnimeReadService {
    private static final Logger log = LoggerFactory.getLogger(AnimeReadService.class);
    private final AnimeService anime;
    private final AnimeCache cache;
    private final AnimeCatalogService catalog;
    private final ExecutorService detailPreloader = Executors.newFixedThreadPool(2, runnable -> {
        Thread thread = new Thread(runnable, "anime-detail-preloader");
        thread.setDaemon(true);
        return thread;
    });
    private final long listTtl, detailTtl, genreTtl;
    public AnimeReadService(AnimeService anime, AnimeCache cache, AnimeCatalogService catalog,
                           @Value("${ANIME_LIST_CACHE_TTL_SECONDS:86400}") long listTtl,
                           @Value("${ANIME_DETAIL_CACHE_TTL_SECONDS:86400}") long detailTtl,
                           @Value("${ANIME_GENRE_CACHE_TTL_SECONDS:2592000}") long genreTtl) {
        this.anime = anime; this.cache = cache; this.catalog = catalog;
        this.listTtl = listTtl; this.detailTtl = detailTtl; this.genreTtl = genreTtl;
    }
    public AnimeDetailResponse findDetail(Integer id) {
        if (id == null || id <= 0) throw new ApiException(400, "올바르지 않은 애니 ID입니다.");
        String key = cache.generation() + ":detail:" + id;
        AnimeDetailResponse result = cache.get(key, new TypeReference<>() {});
        if (result != null) return result;
        try { result = anime.findDetail(id); } catch (AnimeNotFoundException missing) { result = null; }
        if (result == null || result.description() == null || result.description().isBlank()
                || result.image() == null || result.image().large() == null || result.image().large().isBlank()) {
            try { result = AnimeDetailResponse.from(catalog.fetchDetail(id)); }
            catch (ApiException failure) { if (result == null || failure.status() < 500) throw failure; }
        }
        result = catalog.localize(result);
        if (result != null && !TranslationService.needsTranslation(result.title()) && !TranslationService.needsTranslation(result.description())
                && result.characters().stream().noneMatch(c -> c.name() != null && TranslationService.needsTranslation(c.name().nativeTitle())))
            // fetchDetail/localize may invalidate the cache generation, so use the
            // current generation when putting the fully prepared detail response.
            cache.put(cache.generation() + ":detail:" + id, result, detailTtl);
        return result;
    }
    public List<AnimeListResponse> findList(String type, String season, Integer year, Integer limit, Set<Integer> exclude) {
        // Include current quarter in the key so a default-season request cannot reuse last quarter's data.
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        String key = cache.generation() + ":list:" + Arrays.asList(type, season, year, limit, new TreeSet<>(exclude == null ? Set.of() : exclude), today.getYear(), (today.getMonthValue()-1)/3);
        List<AnimeListResponse> result = cache.get(key, new TypeReference<>() {});
        if (result != null) {
            prewarmDetails(result);
            return result;
        }
        result = anime.findList(type, season, year, limit, exclude);
        cache.put(key, result, "genre".equals(type) ? genreTtl : listTtl);
        prewarmDetails(result);
        return result;
    }
    public AnimeHomeResponse findHome(String limit) {
        String key = cache.generation() + ":home:" + limit;
        AnimeHomeResponse result = cache.get(key, new TypeReference<>() {});
        if (result != null) {
            prewarmHome(result);
            return result;
        }
        result = anime.findHome(limit);
        cache.put(key, result, listTtl);
        prewarmHome(result);
        return result;
    }

    /**
     * Prepare details asynchronously after a list has been loaded. The request
     * that rendered the list is not held up, while findDetail reuses MongoDB
     * translations and writes the completed response to Redis.
     */
    private void prewarmDetails(Collection<AnimeListResponse> items) {
        if (items == null || items.isEmpty()) return;
        for (AnimeListResponse item : items) {
            if (item == null || item.id() == null) continue;
            detailPreloader.submit(() -> {
                try {
                    findDetail(item.id());
                } catch (RuntimeException failure) {
                    log.debug("Anime detail prewarm skipped: id={} reason={}", item.id(), failure.getMessage());
                }
            });
        }
        log.info("Anime detail prewarm queued: count={}", items.size());
    }

    private void prewarmHome(AnimeHomeResponse home) {
        if (home == null) return;
        List<AnimeListResponse> items = new ArrayList<>();
        if (home.trending() != null) items.addAll(home.trending());
        if (home.completed() != null) items.addAll(home.completed());
        if (home.ova() != null) items.addAll(home.ova());
        prewarmDetails(items);
    }
}
