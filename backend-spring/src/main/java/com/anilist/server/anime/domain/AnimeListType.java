package com.anilist.server.anime.domain;

import com.anilist.server.anime.exception.InvalidAnimeQueryException;

import java.util.Arrays;

public enum AnimeListType {
    TRENDING("trending"),
    COMPLETED("completed"),
    UPCOMING("upcoming"),
    OVA("ova"),
    AIRING("airing"),
    GENRE("genre");

    private final String value;

    AnimeListType(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static AnimeListType from(String value) {
        String normalized = "upcomming".equalsIgnoreCase(value) ? "upcoming" : value;

        return Arrays.stream(values())
                .filter(type -> type.value.equalsIgnoreCase(normalized))
                .findFirst()
                .orElseThrow(() -> new InvalidAnimeQueryException("지원하지 않는 애니 타입입니다: " + value));
    }
}
