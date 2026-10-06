package com.anilist.server.anime.dto;

import com.anilist.server.anime.domain.AnimeDocument;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AnimeListResponse(
        @JsonProperty("_id") Integer id,
        Integer idMal,
        String type,
        String title,
        AnimeDocument.OriginalTitle originalTitle,
        AnimeDocument.Image image,
        String bannerImage,
        List<String> genres,
        String days,
        AnimeDocument.AnimeDate startDate,
        String season,
        Integer seasonYear,
        Integer episodes,
        String status,
        Integer averageScore,
        Integer popularity,
        List<String> studio,
        AnimeDocument.NextAiringEpisode nextAiringEpisode
) {
    public static AnimeListResponse from(AnimeDocument anime) {
        return new AnimeListResponse(
                anime.id(), anime.idMal(), anime.type(), anime.title(), anime.originalTitle(), anime.image(),
                anime.bannerImage(), anime.genres(), anime.days(), anime.startDate(), anime.season(),
                anime.seasonYear(), anime.episodes(), anime.status(), anime.averageScore(), anime.popularity(),
                anime.studio(), anime.nextAiringEpisode()
        );
    }
}
