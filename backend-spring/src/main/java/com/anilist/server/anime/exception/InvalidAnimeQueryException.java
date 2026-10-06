package com.anilist.server.anime.exception;

public class InvalidAnimeQueryException extends RuntimeException {

    public InvalidAnimeQueryException(String message) {
        super(message);
    }
}
