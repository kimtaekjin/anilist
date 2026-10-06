package com.anilist.server.global.data;

import org.bson.Document;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Repository;
import java.util.List;

/** Shared atomic operations for the existing Mongoose document collections. */
@Repository
public class DocumentStore {
    private final MongoTemplate mongo;
    public DocumentStore(MongoTemplate mongo) { this.mongo = mongo; }
    public Document find(String collection, Query query) { return mongo.findOne(query, Document.class, collection); }
    public List<Document> list(String collection, Query query) { return mongo.find(query, Document.class, collection); }
    public long count(String collection, Query query) { return mongo.count(query, collection); }
    public Document insert(String collection, Document data) { return mongo.insert(data, collection); }
    public Document update(String collection, Query query, Update update, boolean upsert) {
        return mongo.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true).upsert(upsert), Document.class, collection);
    }
    public Document remove(String collection, Query query) { return mongo.findAndRemove(query, Document.class, collection); }
    public void removeMany(String collection, Query query) { mongo.remove(query, collection); }
}
