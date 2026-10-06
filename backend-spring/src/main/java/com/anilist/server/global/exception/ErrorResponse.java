package com.anilist.server.global.exception;

import java.time.Instant;

public record ErrorResponse(
        int status,
        String code,
        String message,
        Instant timestamp
) {
}
