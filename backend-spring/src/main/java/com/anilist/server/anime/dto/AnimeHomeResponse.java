package com.anilist.server.anime.dto;

import java.util.List;

public record AnimeHomeResponse(
        List<AnimeListResponse> trending,
        List<AnimeListResponse> completed,
        List<AnimeListResponse> ova
) {}
