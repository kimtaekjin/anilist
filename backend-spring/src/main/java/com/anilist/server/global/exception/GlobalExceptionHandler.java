package com.anilist.server.global.exception;

import com.anilist.server.anime.exception.AnimeNotFoundException;
import com.anilist.server.anime.exception.InvalidAnimeQueryException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<java.util.Map<String, String>> handleApi(ApiException exception) {
        return ResponseEntity.status(exception.status()).body(java.util.Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler({org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class})
    public ResponseEntity<java.util.Map<String, String>> handleInvalidInput(Exception exception) {
        return ResponseEntity.badRequest().body(java.util.Map.of("message", "올바르지 않은 요청입니다."));
    }

    @ExceptionHandler(AnimeNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleAnimeNotFound(AnimeNotFoundException exception) {
        ErrorResponse response = new ErrorResponse(
                HttpStatus.NOT_FOUND.value(),
                "ANIME_NOT_FOUND",
                exception.getMessage(),
                Instant.now()
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(InvalidAnimeQueryException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAnimeQuery(InvalidAnimeQueryException exception) {
        ErrorResponse response = new ErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                "INVALID_ANIME_QUERY",
                exception.getMessage(),
                Instant.now()
        );

        return ResponseEntity.badRequest().body(response);
    }
}
