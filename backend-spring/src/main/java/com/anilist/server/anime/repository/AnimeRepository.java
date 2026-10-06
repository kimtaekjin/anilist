package com.anilist.server.anime.repository;

import com.anilist.server.anime.domain.AnimeDocument;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface AnimeRepository extends MongoRepository<AnimeDocument, Integer> {

    @Query("{ 'contentTypes': ?0 }")
    List<AnimeDocument> findByContentType(String contentType, Sort sort);

    @Query("{ 'season': ?0, 'seasonYear': ?1, 'isCatalogActive': { $ne: false } }")
    List<AnimeDocument> findActiveCatalogBySeason(String season, Integer year, Sort sort);
}
