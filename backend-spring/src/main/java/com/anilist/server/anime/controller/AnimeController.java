package com.anilist.server.anime.controller;

import com.anilist.server.anime.dto.AnimeDetailResponse;
import com.anilist.server.anime.dto.AnimeHomeResponse;
import com.anilist.server.anime.dto.AnimeListResponse;
import com.anilist.server.anime.service.AnimeReadService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/service/anime")
public class AnimeController {

    private final AnimeReadService animeService;

    public AnimeController(AnimeReadService animeService) {
        this.animeService = animeService;
    }

    @GetMapping("/detail/{id}")
    public ResponseEntity<AnimeDetailResponse> findDetail(@PathVariable Integer id,
            @RequestParam(defaultValue = "detail") String type) {
        if (!"detail".equals(type)) com.anilist.server.anime.domain.AnimeListType.from(type);
        return ResponseEntity.ok(animeService.findDetail(id));
    }

    @GetMapping("/home")
    public ResponseEntity<AnimeHomeResponse> findHome(@RequestParam(required = false) String limit) {
        return ResponseEntity.ok(animeService.findHome(limit));
    }

    @GetMapping("/{type}")
    public ResponseEntity<List<AnimeListResponse>> findList(
            @PathVariable String type,
            @RequestParam(required = false) String season,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String exclude
    ) {
        Set<Integer> excludedIds = parseExcludedIds(exclude);
        return ResponseEntity.ok(animeService.findList(type, season, year, limit, excludedIds));
    }

    private Set<Integer> parseExcludedIds(String exclude) {
        if (exclude == null || exclude.isBlank()) return Set.of();

        return Arrays.stream(exclude.split(","))
                .map(String::trim)
                .filter(value -> value.matches("\\d+"))
                .filter(value -> value.length() < 11)
                .map(Long::valueOf)
                .filter(id -> id <= Integer.MAX_VALUE)
                .map(Long::intValue)
                .filter(id -> id > 0)
                .collect(Collectors.toSet());
    }
}
