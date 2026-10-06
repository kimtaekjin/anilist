package com.anilist.server.anime.dto;

import com.anilist.server.anime.domain.AnimeDocument;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AnimeDetailResponse(
        @JsonProperty("_id") Integer id,
        Integer idMal,
        String type,
        String title,
        AnimeDocument.OriginalTitle originalTitle,
        String description,
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
        AnimeDocument.NextAiringEpisode nextAiringEpisode,
        AnimeDocument.Trailer trailer,
        List<AnimeDocument.AnimeCharacter> characters
) {
    public static AnimeDetailResponse from(AnimeDocument anime) {
        return new AnimeDetailResponse(
                anime.id(),
                anime.idMal(),
                anime.type(),
                anime.title(),
                anime.originalTitle(),
                anime.description(),
                anime.image(),
                anime.bannerImage(),
                anime.genres(),
                anime.days(),
                anime.startDate(),
                anime.season(),
                anime.seasonYear(),
                anime.episodes(),
                anime.status(),
                anime.averageScore(),
                anime.popularity(),
                anime.studio(),
                anime.nextAiringEpisode(),
                anime.trailer(),
                anime.characters() == null ? List.of() : anime.characters()
        );
    }
}
