package com.anilist.server.post;

import com.anilist.server.global.data.DocumentStore;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.List;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/** Idempotently moves legacy embedded post comments into the postcomments collection. */
@Component
@Order(1)
public class PostCommentMigration implements ApplicationRunner {
    private final DocumentStore store;
    private final MongoTemplate mongo;

    public PostCommentMigration(DocumentStore store, MongoTemplate mongo) {
        this.store = store;
        this.mongo = mongo;
    }

    @Override
    public void run(ApplicationArguments args) {
        Query legacyPosts = query(where("comments.0").exists(true));
        for (Document post : store.list("posts", legacyPosts)) migrate(post);
    }

    private void migrate(Document post) {
        ObjectId postId = post.getObjectId("_id");
        List<Document> comments = post.getList("comments", Document.class, List.of());
        for (Document old : comments) {
            ObjectId id = old.getObjectId("_id");
            if (id == null) id = new ObjectId();
            Date createdAt = old.getDate("createdAt");
            Update update = new Update()
                    .setOnInsert("postId", postId)
                    .setOnInsert("parentCommentId", null)
                    .setOnInsert("content", old.getString("content"))
                    .setOnInsert("author", old.getString("author"))
                    .setOnInsert("userId", old.getString("userId"))
                    .setOnInsert("recommendCount", 0)
                    .setOnInsert("deleted", false)
                    .setOnInsert("createdAt", createdAt == null ? new Date() : createdAt)
                    .setOnInsert("updatedAt", old.getDate("updatedAt") == null ? new Date() : old.getDate("updatedAt"));
            mongo.upsert(query(where("_id").is(id)), update, "postcomments");
        }
        // Every insert above is an idempotent upsert. Only remove the embedded source after all completed.
        mongo.updateFirst(query(where("_id").is(postId)), new Update().unset("comments"), "posts");
    }
}
