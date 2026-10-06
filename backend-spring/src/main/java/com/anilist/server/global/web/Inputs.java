package com.anilist.server.global.web;

import com.anilist.server.global.exception.ApiException;
import org.bson.types.ObjectId;
import java.util.Map;

public final class Inputs {
    private Inputs() {}
    public static String text(Map<String, Object> body, String key) {
        return body != null && body.get(key) instanceof String value ? value.trim() : "";
    }
    public static String password(Map<String, Object> body) {
        return body != null && body.get("password") instanceof String value ? value : "";
    }
    public static ObjectId objectId(String id) {
        if (id == null || !ObjectId.isValid(id)) throw new ApiException(400, "올바르지 않은 ID입니다.");
        return new ObjectId(id);
    }
    public static int page(String value, int fallback, int max) {
        try {
            double number = Double.parseDouble(value);
            return Double.isFinite(number) ? (int)Math.max(1, Math.min(max, Math.floor(number))) : fallback;
        } catch (RuntimeException ignored) { return fallback; }
    }
    public static void require(boolean valid, String message) {
        if (!valid) throw new ApiException(400, message);
    }
}
