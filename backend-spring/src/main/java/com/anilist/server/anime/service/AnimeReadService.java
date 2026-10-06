package com.anilist.server.anime.service;

import com.anilist.server.anime.dto.*;
import com.anilist.server.anime.exception.AnimeNotFoundException;
import com.anilist.server.anime.sync.AnimeCatalogService;
import com.anilist.server.anime.sync.TranslationService;
import com.anilist.server.global.exception.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

/** Read-through caching and upstream fallback are separated from list selection rules. */
@Service
public class AnimeReadService {
    private final AnimeService anime;
    private final AnimeCache cache;
    private final AnimeCatalogService catalog;
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
            cache.put(key, result, detailTtl);
        return result;
    }
    public List<AnimeListResponse> findList(String type, String season, Integer year, Integer limit, Set<Integer> exclude) {
        // Include current quarter in the key so a default-season request cannot reuse last quarter's data.
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        String key = cache.generation() + ":list:" + Arrays.asList(type, season, year, limit, new TreeSet<>(exclude == null ? Set.of() : exclude), today.getYear(), (today.getMonthValue()-1)/3);
        List<AnimeListResponse> result = cache.get(key, new TypeReference<>() {});
        if (result != null) return result;
        result = anime.findList(type, season, year, limit, exclude);
        cache.put(key, result, "genre".equals(type) ? genreTtl : listTtl);
        return result;
    }
    public AnimeHomeResponse findHome(String limit) {
        String key = cache.generation() + ":home:" + limit;
        AnimeHomeResponse result = cache.get(key, new TypeReference<>() {});
        if (result != null) return result;
        result = anime.findHome(limit); cache.put(key, result, listTtl); return result;
    }
}
