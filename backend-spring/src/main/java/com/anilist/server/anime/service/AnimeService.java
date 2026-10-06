package com.anilist.server.anime.service;

import com.anilist.server.anime.domain.AnimeDocument;
import com.anilist.server.anime.domain.AnimeListType;
import com.anilist.server.anime.dto.AnimeDetailResponse;
import com.anilist.server.anime.dto.AnimeHomeResponse;
import com.anilist.server.anime.dto.AnimeListResponse;
import com.anilist.server.anime.exception.AnimeNotFoundException;
import com.anilist.server.anime.exception.InvalidAnimeQueryException;
import com.anilist.server.anime.repository.AnimeRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AnimeService {

    private static final int MAX_RESPONSE_LIMIT = 30;
    private static final int CATALOG_START_YEAR = 2000;
    private static final Set<String> VALID_SEASONS = Set.of("WINTER", "SPRING", "SUMMER", "FALL");
    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    private final AnimeRepository animeRepository;

    public AnimeService(AnimeRepository animeRepository) {
        this.animeRepository = animeRepository;
    }

    public AnimeDetailResponse findDetail(Integer animeId) {
        AnimeDocument anime = animeRepository.findById(animeId)
                .orElseThrow(() -> new AnimeNotFoundException(animeId));

        return AnimeDetailResponse.from(anime);
    }

    public AnimeHomeResponse findHome(String requestedLimit) {
        int limit = homeLimit(requestedLimit);
        List<AnimeListResponse> trending = findList("trending", null, null, limit, Set.of());
        Set<Integer> trendingIds = trending.stream().map(AnimeListResponse::id).collect(Collectors.toSet());
        List<AnimeListResponse> completed = findList("completed", null, null, limit, trendingIds);
        List<AnimeListResponse> ova = findList("ova", null, null, limit, Set.of());
        return new AnimeHomeResponse(trending, completed, ova);
    }

    // Preserve the Node home endpoint's default, floor and cap behavior.
    private int homeLimit(String requestedLimit) {
        if (requestedLimit == null || requestedLimit.isBlank()) return MAX_RESPONSE_LIMIT;
        try {
            double value = Double.parseDouble(requestedLimit.trim());
            if (!Double.isFinite(value) || value < 1) return MAX_RESPONSE_LIMIT;
            return (int) Math.min(Math.floor(value), MAX_RESPONSE_LIMIT);
        } catch (NumberFormatException exception) {
            return MAX_RESPONSE_LIMIT;
        }
    }

    public List<AnimeListResponse> findList(
            String requestedType,
            String requestedSeason,
            Integer requestedYear,
            Integer requestedLimit,
            Set<Integer> excludedIds
    ) {
        AnimeListType type = AnimeListType.from(requestedType);
        validateLimit(requestedLimit);

        List<AnimeDocument> documents = type == AnimeListType.GENRE
                ? findGenreList(requestedSeason, requestedYear)
                : animeRepository.findByContentType(type.value(), sortFor(type));

        long limit = requestedLimit == null ? Long.MAX_VALUE : requestedLimit;
        Set<Integer> safeExcludedIds = excludedIds == null ? Set.of() : excludedIds;

        return documents.stream()
                .filter(anime -> !safeExcludedIds.contains(anime.id()))
                .limit(limit)
                .map(AnimeListResponse::from)
                .toList();
    }

    private List<AnimeDocument> findGenreList(String requestedSeason, Integer requestedYear) {
        LocalDate today = LocalDate.now(KOREA_ZONE);
        String season = requestedSeason == null || requestedSeason.isBlank()
                ? seasonFor(today.getMonthValue())
                : requestedSeason.toUpperCase();
        int year = requestedYear == null ? today.getYear() : requestedYear;

        if (!VALID_SEASONS.contains(season)) {
            throw new InvalidAnimeQueryException("올바른 분기를 입력해 주세요.");
        }
        if (year < CATALOG_START_YEAR || year > today.getYear()) {
            throw new InvalidAnimeQueryException("올바른 연도를 입력해 주세요.");
        }

        return animeRepository.findActiveCatalogBySeason(season, year, popularitySort());
    }

    private void validateLimit(Integer limit) {
        if (limit != null && (limit < 1 || limit > MAX_RESPONSE_LIMIT)) {
            throw new InvalidAnimeQueryException("limit은 1 이상 30 이하여야 합니다.");
        }
    }

    private Sort sortFor(AnimeListType type) {
        if (type == AnimeListType.COMPLETED) {
            return Sort.by(Sort.Order.desc("averageScore"), Sort.Order.desc("popularity"));
        }
        return popularitySort();
    }

    private Sort popularitySort() {
        return Sort.by(Sort.Order.desc("popularity"), Sort.Order.desc("averageScore"));
    }

    private String seasonFor(int month) {
        if (month <= 3) return "WINTER";
        if (month <= 6) return "SPRING";
        if (month <= 9) return "SUMMER";
        return "FALL";
    }
}
