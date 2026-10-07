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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
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
    private final TransactionTemplate transactions;
    private static final String COMMENTS = "postcomments", VOTES = "postcommentvotes";
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    public PostService(DocumentStore store, RedisStore redis, MongoTransactionManager transactionManager,
            @Value("${POST_VIEW_TTL_SECONDS:86400}") long ttl) {
        this.store = store; this.redis = redis; this.viewTtl = Duration.ofSeconds(ttl);
        this.transactions = new TransactionTemplate(transactionManager);
    }
    public Map<String, Object> list(String requestedPage, String requestedLimit) {
        int page = Inputs.page(requestedPage, 1, Integer.MAX_VALUE), limit = Inputs.page(requestedLimit, 15, 50);
        Query query = new Query().with(Sort.by(Sort.Order.desc("isNotice"), Sort.Order.desc("number")))
                .skip((long)(page - 1) * limit).limit(limit);
        query.fields().exclude("content").exclude("viewLogs");
        List<Map<String, Object>> items = store.list("posts", query).stream().map(post -> {
            Map<String, Object> item = DocumentResponses.from(post);
            item.remove("userId"); item.remove("comments"); item.remove("updatedAt");
            item.put("commentCount", store.count(COMMENTS, query(where("postId").is(post.getObjectId("_id")))));
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
                .append("author", user.userName()).append("userId", user.userId())
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
        ObjectId postId = Inputs.objectId(id);
        transactions.executeWithoutResult(status -> {
            List<Object> commentIds = store.list(COMMENTS, query(where("postId").is(postId))).stream()
                    .map(comment -> comment.get("_id")).toList();
            if (!commentIds.isEmpty()) store.removeMany(VOTES, query(where("commentId").in(commentIds)));
            store.removeMany(COMMENTS, query(where("postId").is(postId)));
            store.remove("posts", query(where("_id").is(postId)));
        });
    }
    public Map<String, Object> addComment(String id, Map<String, Object> body, AuthUser user) {
        String content = Inputs.text(body, "content");
        Inputs.require(!content.isEmpty() && content.length() <= 1000, "댓글은 1~1000자로 입력해 주세요.");
        ObjectId postId = Inputs.objectId(id);
        if (store.find("posts", query(where("_id").is(postId))) == null) throw new ApiException(404, "게시글이 존재하지 않습니다.");
        ObjectId parentId = optionalObjectId(body.get("parentCommentId"));
        if (parentId != null) requireRootComment(postId, parentId);
        Date now = new Date();
        Document comment = store.insert(COMMENTS, new Document("postId", postId).append("parentCommentId", parentId)
                .append("content", content).append("author", user.userName()).append("userId", user.userId())
                .append("recommendCount", 0).append("deleted", false).append("createdAt", now).append("updatedAt", now));
        return commentResponse(comment, false);
    }
    public List<Map<String, Object>> listComments(String id, AuthUser viewer) {
        ObjectId postId = Inputs.objectId(id); requirePost(id);
        List<Document> all = store.list(COMMENTS, query(where("postId").is(postId)).with(Sort.by(Sort.Direction.ASC, "createdAt")));
        Set<Object> voted = viewer == null || all.isEmpty() ? Set.of() : store.list(VOTES,
                query(where("commentId").in(all.stream().map(c -> c.get("_id")).toList()).and("userId").is(viewer.userId())))
                .stream().map(v -> v.get("commentId")).collect(java.util.stream.Collectors.toSet());
        Map<ObjectId, List<Map<String, Object>>> replies = new LinkedHashMap<>();
        for (Document comment : all) {
            ObjectId parent = comment.getObjectId("parentCommentId");
            if (parent != null) replies.computeIfAbsent(parent, ignored -> new ArrayList<>())
                    .add(commentResponse(comment, voted.contains(comment.get("_id"))));
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Document comment : all) if (comment.get("parentCommentId") == null) {
            Map<String, Object> root = commentResponse(comment, voted.contains(comment.get("_id")));
            root.put("replies", replies.getOrDefault(comment.getObjectId("_id"), List.of()));
            result.add(root);
        }
        return result;
    }
    public void deleteComment(String postId, String commentId, AuthUser user) {
        ObjectId postObjectId = Inputs.objectId(postId), id = Inputs.objectId(commentId);
        Document comment = requireComment(postObjectId, id);
        ownerOrAdmin(comment, user);
        transactions.executeWithoutResult(status -> {
            boolean hasReplies = store.count(COMMENTS, query(where("postId").is(postObjectId).and("parentCommentId").is(id))) > 0;
            if (comment.get("parentCommentId") == null && hasReplies) {
                store.update(COMMENTS, query(where("_id").is(id)), new Update().set("deleted", true)
                        .set("content", "").set("author", "삭제된 댓글").unset("userId").set("updatedAt", new Date()), false);
            } else {
                store.remove(COMMENTS, query(where("_id").is(id)));
                ObjectId parentId = comment.getObjectId("parentCommentId");
                if (parentId != null && store.count(COMMENTS, query(where("parentCommentId").is(parentId))) == 0) {
                    store.remove(COMMENTS, query(where("_id").is(parentId).and("deleted").is(true)));
                    store.removeMany(VOTES, query(where("commentId").is(parentId)));
                }
            }
            store.removeMany(VOTES, query(where("commentId").is(id)));
        });
    }
    public Object recommendComment(String postId, String commentId, AuthUser user, boolean recommend) {
        ObjectId postObjectId = Inputs.objectId(postId), id = Inputs.objectId(commentId);
        try {
            return transactions.execute(status -> recommendCommentInTransaction(postObjectId, id, user, recommend));
        } catch (DuplicateKeyException duplicate) {
            return voteResponse(requireComment(postObjectId, id), true);
        }
    }
    private Object recommendCommentInTransaction(ObjectId postId, ObjectId id, AuthUser user, boolean recommend) {
        Document current = requireComment(postId, id);
        if (Boolean.TRUE.equals(current.getBoolean("deleted"))) throw new ApiException(400, "삭제된 댓글은 추천할 수 없습니다.");
        Query vote = query(where("commentId").is(id).and("userId").is(user.userId()));
        Document existing = store.find(VOTES, vote);
        if (recommend) {
            if (existing != null) return voteResponse(current, true);
            store.insert(VOTES, new Document("commentId", id).append("userId", user.userId()).append("createdAt", new Date()));
            Document updated = store.update(COMMENTS, query(where("_id").is(id)), new Update().inc("recommendCount", 1), false);
            return voteResponse(updated, true);
        }
        if (existing == null) return voteResponse(current, false);
        store.remove(VOTES, vote);
        Document updated = store.update(COMMENTS, query(where("_id").is(id)), new Update().inc("recommendCount", -1), false);
        return voteResponse(updated, false);
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
    private Document requireComment(ObjectId postId, ObjectId commentId) {
        Document comment = store.find(COMMENTS, query(where("_id").is(commentId).and("postId").is(postId)));
        if (comment == null) throw new ApiException(404, "댓글이 존재하지 않습니다.");
        return comment;
    }
    private Document requireRootComment(ObjectId postId, ObjectId commentId) {
        Document comment = requireComment(postId, commentId);
        if (comment.get("parentCommentId") != null || Boolean.TRUE.equals(comment.getBoolean("deleted")))
            throw new ApiException(400, "해당 댓글에는 답글을 작성할 수 없습니다.");
        return comment;
    }
    private ObjectId optionalObjectId(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        return Inputs.objectId(value.toString());
    }
    private Map<String, Object> commentResponse(Document comment, boolean recommended) {
        Map<String, Object> response = DocumentResponses.from(comment);
        response.put("recommended", recommended);
        response.put("createdAt", date(comment.getDate("createdAt"), "yyyy-MM-dd HH:mm:ss")); return response;
    }
    private Map<String, Object> voteResponse(Document comment, boolean recommended) {
        return Map.of("commentId", comment.getObjectId("_id").toHexString(), "recommended", recommended,
                "recommendCount", Math.max(0, ((Number)comment.getOrDefault("recommendCount", 0)).intValue()));
    }
    private String date(Date date, String pattern) {
        return date == null ? "" : DateTimeFormatter.ofPattern(pattern).withZone(ZONE).format(date.toInstant());
    }
}
