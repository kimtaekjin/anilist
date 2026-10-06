package com.anilist.server.global.web;

import org.bson.Document;
import org.bson.types.ObjectId;
import java.util.*;

/** Explicit conversion keeps BSON ObjectId internals out of HTTP responses. */
public final class DocumentResponses {
    private DocumentResponses() {}
    public static Map<String, Object> from(Document source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> { if (!key.equals("_class")) result.put(key, convert(value)); });
        return result;
    }
    private static Object convert(Object value) {
        if (value instanceof ObjectId id) return id.toHexString();
        if (value instanceof Date date) return date.toInstant().toString();
        if (value instanceof Document document) return from(document);
        if (value instanceof List<?> list) return list.stream().map(DocumentResponses::convert).toList();
        return value;
    }
}
