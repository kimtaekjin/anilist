package com.anilist.server.global.data;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/** Preserve Mongoose uniqueness guarantees on both existing and fresh databases. */
@Component
@org.springframework.core.annotation.Order(0)
@ConditionalOnProperty(name="app.initialize-indexes", havingValue="true", matchIfMissing=true)
public class MongoIndexes implements ApplicationRunner {
    private final MongoTemplate mongo;
    public MongoIndexes(MongoTemplate mongo) { this.mongo = mongo; }
    @Override public void run(ApplicationArguments args) {
        mongo.indexOps("users").ensureIndex(new Index().on("email", Direction.ASC).unique());
        mongo.indexOps("users").ensureIndex(new Index().on("username", Direction.ASC).unique());
        mongo.indexOps("posts").ensureIndex(new Index().on("number", Direction.ASC).unique());
        mongo.indexOps("posts").ensureIndex(new Index().on("isNotice", Direction.DESC).on("number", Direction.DESC));
        mongo.indexOps("postcomments").ensureIndex(new Index().on("postId", Direction.ASC).on("parentCommentId", Direction.ASC).on("createdAt", Direction.DESC));
        mongo.indexOps("postcommentvotes").ensureIndex(new Index().on("commentId", Direction.ASC).on("userId", Direction.ASC).unique());
        mongo.indexOps("animecommentvotes").ensureIndex(new Index().on("commentId", Direction.ASC).on("userId", Direction.ASC).unique());
        mongo.indexOps("animecomments").ensureIndex(new Index().on("animeId", Direction.ASC).on("parentCommentId", Direction.ASC).on("recommendCount", Direction.DESC).on("createdAt", Direction.DESC));
        mongo.indexOps("animecomments").ensureIndex(new Index().on("animeId", Direction.ASC).on("parentCommentId", Direction.ASC).on("createdAt", Direction.DESC));
        mongo.indexOps("translations").ensureIndex(new Index().on("provider", Direction.ASC).on("originalText", Direction.ASC)
                .on("sourceLang", Direction.ASC).on("targetLang", Direction.ASC).unique());
    }
}
