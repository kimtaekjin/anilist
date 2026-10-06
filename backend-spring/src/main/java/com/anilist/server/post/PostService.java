package com.anilist.server.post;

import com.anilist.server.global.cache.RedisStore;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.global.exception.ApiException;
import com.anilist.server.global.web.*;
import com.anilist.server.user.UserAccount.AuthUser;
import com.anilist.server.user.UserService;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Service;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class PostService {
    private final DocumentStore store;
    private final RedisStore redis;
    private final Duration viewTtl;
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    public PostService(DocumentStore store, RedisStore redis, @Value("${POST_VIEW_TTL_SECONDS:86400}") long ttl) {
        this.store = store; this.redis = redis; this.viewTtl = Duration.ofSeconds(ttl);
    }
    public Map<String, Object> list(String requestedPage, String requestedLimit) {
        int page = Inputs.page(requestedPage, 1, Integer.MAX_VALUE), limit = Inputs.page(requestedLimit, 15, 50);
        Query query = new Query().with(Sort.by(Sort.Order.desc("isNotice"), Sort.Order.desc("number")))
                .skip((long)(page - 1) * limit).limit(limit);
        query.fields().exclude("content").exclude("viewLogs");
        List<Map<String, Object>> items = store.list("posts", query).stream().map(post -> {
            Map<String, Object> item = DocumentResponses.from(post);
            item.remove("userId"); item.remove("comments"); item.remove("updatedAt");
            item.put("commentCount", comments(post).size());
            Date date = post.getDate("createdAt");
            String pattern = date != null && date.toInstant().atZone(ZONE).toLocalDate().equals(LocalDate.now(ZONE)) ? "HH:mm" : "MM-dd";
            item.put("date", date(date, pattern));
            return item;
        }).toList();
        return Map.of("items", items, "total", store.count("posts", new Query()), "page", page, "limit", limit);
    }
    public Map<String, Object> create(Map<String, Object> body, AuthUser user) {
        validatePost(body);
        Document counter = store.update("counters", query(where("_id").is("post")), new Update().inc("seq", 1), true);
        Date now = new Date();
        Document post = new Document("number", counter.get("seq")).append("title", Inputs.text(body, "title"))
                .append("content", Inputs.text(body, "content")).append("category", category(body, "자유"))
                .append("author", user.userName()).append("userId", user.userId()).append("comments", new ArrayList<>())
                .append("recommend", 0).append("isNotice", false).append("views", 0).append("viewLogs", new ArrayList<>())
                .append("createdAt", now).append("updatedAt", now);
        return DocumentResponses.from(store.insert("posts", post));
    }
    public Map<String, Object> update(String id, Map<String, Object> body, AuthUser user) {
        Document existing = requirePost(id); validatePost(body);
        if (!user.userId().equals(existing.getString("userId"))) throw new ApiException(403, "수정 권한이 없습니다.");
        Document changed = store.update("posts", query(where("_id").is(Inputs.objectId(id)).and("userId").is(user.userId())),
                new Update().set("title", Inputs.text(body, "title")).set("content", Inputs.text(body, "content"))
                        .set("category", category(body, existing.getString("category"))).set("updatedAt", new Date()), false);
        if (changed == null) throw new ApiException(404, "게시글이 존재하지 않습니다.");
        return DocumentResponses.from(changed);
    }
    public Map<String, Object> detail(String id, AuthUser viewer, String ip, String agent) {
        ObjectId objectId = Inputs.objectId(id);
        String identity = viewer == null ? "guest:" + ip + ":" + Objects.toString(agent, "") : "user:" + viewer.userId();
        boolean increment = redis.acquire("post:view:" + id + ":" + UserService.sha256(identity), "1", viewTtl).orElse(true);
        Query query = query(where("_id").is(objectId)); query.fields().exclude("comments").exclude("viewLogs");
        Document post = increment ? store.update("posts", query, new Update().inc("views", 1), false) : store.find("posts", query);
        if (post == null) throw new ApiException(404, "게시글이 존재하지 않습니다.");
        Map<String, Object> response = DocumentResponses.from(post);
        response.remove("comments"); response.remove("viewLogs");
        response.put("createdAt", date(post.getDate("createdAt"), "yyyy-MM-dd HH:mm:ss"));
        response.put("updatedAt", date(post.getDate("updatedAt"), "yyyy-MM-dd HH:mm:ss"));
        return response;
    }
    public void delete(String id, AuthUser user) {
        Document post = requirePost(id);
        ownerOrAdmin(post, user);
        store.remove("posts", query(where("_id").is(Inputs.objectId(id))));
    }
    public Map<String, Object> addComment(String id, Map<String, Object> body, AuthUser user) {
        String content = Inputs.text(body, "content");
        Inputs.require(!content.isEmpty() && content.length() <= 1000, "댓글은 1~1000자로 입력해 주세요.");
        Document comment = new Document("_id", new ObjectId()).append("content", content).append("author", user.userName())
                .append("userId", user.userId()).append("createdAt", new Date()).append("updatedAt", new Date());
        Document post = store.update("posts", query(where("_id").is(Inputs.objectId(id))),
                new Update().push("comments", comment).set("updatedAt", new Date()), false);
        if (post == null) throw new ApiException(404, "게시글이 존재하지 않습니다.");
        return commentResponse(comment);
    }
    public List<Map<String, Object>> listComments(String id) { return comments(requirePost(id)).stream().map(this::commentResponse).toList(); }
    public void deleteComment(String postId, String commentId, AuthUser user) {
        ObjectId id = Inputs.objectId(commentId);
        Document comment = comments(requirePost(postId)).stream().filter(c -> id.equals(c.get("_id"))).findFirst()
                .orElseThrow(() -> new ApiException(404, "댓글이 존재하지 않습니다."));
        ownerOrAdmin(comment, user);
        store.update("posts", query(where("_id").is(Inputs.objectId(postId))),
                new Update().pull("comments", new Document("_id", id)).set("updatedAt", new Date()), false);
    }
    private Document requirePost(String id) {
        Document post = store.find("posts", query(where("_id").is(Inputs.objectId(id))));
        if (post == null) throw new ApiException(404, "게시글이 존재하지 않습니다."); return post;
    }
    private void ownerOrAdmin(Document doc, AuthUser user) {
        if (!user.userId().equals(doc.getString("userId")) && !user.admin()) throw new ApiException(403, "삭제 권한이 없습니다.");
    }
    private void validatePost(Map<String, Object> body) {
        String title = Inputs.text(body, "title"), content = Inputs.text(body, "content");
        Inputs.require(!title.isEmpty() && title.length() <= 30 && content.length() >= 10 && content.length() <= 10000,
                "제목(1~30자)과 내용(10~10000자)을 확인해 주세요.");
    }
    private String category(Map<String, Object> body, String fallback) {
        String value = Inputs.text(body, "category"); return value.isBlank() ? Objects.toString(fallback, "자유") : value;
    }
    private List<Document> comments(Document post) { return post.getList("comments", Document.class, List.of()); }
    private Map<String, Object> commentResponse(Document comment) {
        Map<String, Object> response = DocumentResponses.from(comment);
        response.put("createdAt", date(comment.getDate("createdAt"), "yyyy-MM-dd HH:mm:ss")); return response;
    }
    private String date(Date date, String pattern) {
        return date == null ? "" : DateTimeFormatter.ofPattern(pattern).withZone(ZONE).format(date.toInstant());
    }
}
