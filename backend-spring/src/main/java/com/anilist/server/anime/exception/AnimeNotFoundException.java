package com.anilist.server.anime.exception;

public class AnimeNotFoundException extends RuntimeException {

    public AnimeNotFoundException(Integer animeId) {
        super("애니를 찾을 수 없습니다. id=" + animeId);
    }
}
