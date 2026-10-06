package com.anilist.server.anime.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.List;

@Document(collection = "animes")
public record AnimeDocument(
        @Id Integer id,
        Integer idMal,
        String type,
        String title,
        OriginalTitle originalTitle,
        String description,
        Image image,
        String bannerImage,
        List<String> genres,
        String days,
        AnimeDate startDate,
        String season,
        Integer seasonYear,
        Integer episodes,
        String status,
        Integer averageScore,
        Integer popularity,
        List<String> studio,
        NextAiringEpisode nextAiringEpisode,
        List<String> contentTypes,
        Boolean isCatalogActive,
        Trailer trailer,
        List<AnimeCharacter> characters
) {
    public record Trailer(@Field("id") @JsonProperty("id") String videoId, String site) {}
    public record CharacterName(String full, @Field("native") @JsonProperty("native") String nativeTitle) {}
    public record AnimeCharacter(Integer anilistId, String role, CharacterName name, Image image) {}
    public record OriginalTitle(
            String romaji,
            String english,
            @Field("native") @JsonProperty("native") String nativeTitle
    ) {
    }

    public record Image(String large, String extraLarge, String banner) {
    }

    public record AnimeDate(Integer year, Integer month, Integer day) {
    }

    public record NextAiringEpisode(Integer episode, Long airingAt) {
    }
}
