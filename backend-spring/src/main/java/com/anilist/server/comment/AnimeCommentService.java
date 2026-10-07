package com.anilist.server.comment;

import com.anilist.server.anime.repository.AnimeRepository;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.global.exception.ApiException;
import com.anilist.server.global.web.*;
import com.anilist.server.user.UserAccount.AuthUser;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.util.stream.Collectors;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class AnimeCommentService {
    private static final String COMMENTS = "animecomments", VOTES = "animecommentvotes";
    private final DocumentStore store;
    private final AnimeRepository anime;
    private final TransactionTemplate transactions;
    public AnimeCommentService(DocumentStore store, AnimeRepository anime, MongoTransactionManager transactionManager) {
        this.store = store;
        this.anime = anime;
        this.transactions = new TransactionTemplate(transactionManager);
    }
    private void validAnime(int id) { Inputs.require(id > 0, "올바르지 않은 애니 ID입니다."); }
    public Object list(int animeId, String requestedPage, String requestedLimit, AuthUser viewer) {
        validAnime(animeId);
        int page = Inputs.page(requestedPage, 1, Integer.MAX_VALUE), limit = Inputs.page(requestedLimit, 10, 30);
        List<Document> top = store.list(COMMENTS, query(where("animeId").is(animeId).and("parentCommentId").is(null).and("recommendCount").gt(0))
                .with(Sort.by(Sort.Order.desc("recommendCount"), Sort.Order.desc("createdAt"))).limit(3));
        List<Object> topIds = top.stream().map(doc -> doc.get("_id")).toList();
        Criteria regular = where("animeId").is(animeId).and("parentCommentId").is(null).and("_id").nin(topIds);
        List<Document> comments = store.list(COMMENTS, query(regular).with(Sort.by(Sort.Direction.DESC, "createdAt"))
                .skip((long)(page - 1) * limit).limit(limit));
        long total = store.count(COMMENTS, query(regular));
        List<Document> roots = new ArrayList<>(top); roots.addAll(comments);
        List<Document> replies = roots.isEmpty() ? List.of() : store.list(COMMENTS,
                query(where("animeId").is(animeId).and("parentCommentId").in(roots.stream().map(d -> d.get("_id")).toList()))
                        .with(Sort.by(Sort.Direction.ASC, "createdAt")));
        List<Document> all = new ArrayList<>(roots); all.addAll(replies);
        Set<Object> voted = viewer == null || all.isEmpty() ? Set.of() : store.list(VOTES,
                query(where("commentId").in(all.stream().map(d -> d.get("_id")).toList()).and("userId").is(viewer.userId())))
                .stream().map(d -> d.get("commentId")).collect(Collectors.toSet());
        Map<ObjectId, List<Document>> repliesByParent = replies.stream().collect(Collectors.groupingBy(d -> d.getObjectId("parentCommentId")));
        return Map.of("topComments", top.stream().map(d -> decorateTree(d, repliesByParent, voted)).toList(),
                "comments", comments.stream().map(d -> decorateTree(d, repliesByParent, voted)).toList(),
                "total", total, "page", page, "limit", limit, "totalPages", (total + limit - 1) / limit);
    }
    public Object create(int animeId, Map<String, Object> body, AuthUser user) {
        validAnime(animeId);
        String content = Inputs.text(body, "content");
        Inputs.require(!content.isEmpty() && content.length() <= 1000, "댓글은 1~1000자로 입력해 주세요.");
        if (!anime.existsById(animeId)) throw new ApiException(404, "애니 정보를 찾을 수 없습니다.");
        ObjectId parentId = optionalObjectId(body.get("parentCommentId"));
        if (parentId != null) requireRoot(animeId, parentId);
        Document comment = store.insert(COMMENTS, new Document("animeId", animeId).append("parentCommentId", parentId).append("userId", user.userId())
                .append("author", user.userName()).append("content", content).append("recommendCount", 0)
                .append("deleted", false).append("createdAt", new Date()).append("updatedAt", new Date()));
        return decorate(comment, false);
    }
    public Object delete(int animeId, String commentId, AuthUser user) {
        validAnime(animeId); ObjectId id = Inputs.objectId(commentId);
        return transactions.execute(status -> {
            Document comment = store.find(COMMENTS, identity(animeId, id));
            if (comment == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
            if (!user.userId().equals(comment.getString("userId")) && !user.admin())
                throw new ApiException(403, "본인이 작성한 댓글만 삭제할 수 있습니다.");

            boolean hasReplies = store.count(COMMENTS, query(where("animeId").is(animeId).and("parentCommentId").is(id))) > 0;
            if (comment.get("parentCommentId") == null && hasReplies) {
                Document changed = store.update(COMMENTS, identity(animeId, id), new Update().set("deleted", true)
                        .set("content", "").set("author", "삭제된 댓글").unset("userId").set("updatedAt", new Date()), false);
                if (changed == null) throw new ApiException(409, "댓글 상태가 변경되었습니다. 다시 시도해 주세요.");
            } else {
                Document deleted = store.remove(COMMENTS, identity(animeId, id));
                if (deleted == null) throw new ApiException(409, "댓글 상태가 변경되었습니다. 다시 시도해 주세요.");
                ObjectId parentId = comment.getObjectId("parentCommentId");
                if (parentId != null && store.count(COMMENTS, query(where("animeId").is(animeId).and("parentCommentId").is(parentId))) == 0) {
                    store.remove(COMMENTS, query(where("_id").is(parentId).and("animeId").is(animeId).and("deleted").is(true)));
                    store.removeMany(VOTES, query(where("commentId").is(parentId)));
                }
            }
            store.removeMany(VOTES, query(where("commentId").is(id)));
            return Map.of("commentId", commentId, "message", "댓글을 삭제했습니다.");
        });
    }
    public Object recommend(int animeId, String commentId, AuthUser user, boolean recommend) {
        validAnime(animeId); ObjectId id = Inputs.objectId(commentId);
        try {
            return transactions.execute(status -> recommendInTransaction(animeId, commentId, id, user, recommend));
        } catch (DuplicateKeyException duplicate) {
            // A concurrent identical recommendation won the unique-key race.
            Document latest = store.find(COMMENTS, identity(animeId, id));
            if (latest == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
            return voteResponse(commentId, true, latest);
        }
    }
    private Object recommendInTransaction(int animeId, String commentId, ObjectId id, AuthUser user, boolean recommend) {
        Document current = store.find(COMMENTS, identity(animeId, id));
        if (current == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
        if (Boolean.TRUE.equals(current.getBoolean("deleted"))) throw new ApiException(400, "삭제된 댓글은 추천할 수 없습니다.");

        Query voteQuery = query(where("commentId").is(id).and("userId").is(user.userId()));
        Document existingVote = store.find(VOTES, voteQuery);

        if (recommend) {
            if (existingVote != null) return voteResponse(commentId, true, current);
            store.insert(VOTES, new Document("commentId", id).append("userId", user.userId())
                    .append("createdAt", new Date()).append("updatedAt", new Date()));
            Document updated = store.update(COMMENTS, identity(animeId, id),
                    new Update().inc("recommendCount", 1).set("updatedAt", new Date()), false);
            if (updated == null) throw new ApiException(409, "댓글 상태가 변경되었습니다. 다시 시도해 주세요.");
            return voteResponse(commentId, true, updated);
        }

        if (existingVote == null) return voteResponse(commentId, false, current);
        store.remove(VOTES, voteQuery);
        Document updated = store.update(COMMENTS,
                query(where("_id").is(id).and("animeId").is(animeId).and("recommendCount").gt(0)),
                new Update().inc("recommendCount", -1).set("updatedAt", new Date()), false);
        if (updated == null) {
            // Legacy inconsistent data may already have a zero counter. Keep it at zero while removing the vote.
            updated = store.update(COMMENTS, identity(animeId, id),
                    new Update().set("recommendCount", 0).set("updatedAt", new Date()), false);
        }
        if (updated == null) throw new ApiException(409, "댓글 상태가 변경되었습니다. 다시 시도해 주세요.");
        return voteResponse(commentId, false, updated);
    }
    private Query identity(int animeId, ObjectId id) { return query(where("_id").is(id).and("animeId").is(animeId)); }
    private ObjectId optionalObjectId(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        return Inputs.objectId(value.toString());
    }
    private Document requireRoot(int animeId, ObjectId id) {
        Document parent = store.find(COMMENTS, identity(animeId, id));
        if (parent == null || parent.get("parentCommentId") != null || Boolean.TRUE.equals(parent.getBoolean("deleted")))
            throw new ApiException(400, "해당 댓글에는 답글을 작성할 수 없습니다.");
        return parent;
    }
    private Map<String, Object> decorateTree(Document document, Map<ObjectId, List<Document>> replies, Set<Object> voted) {
        Map<String, Object> result = decorate(document, voted.contains(document.get("_id")));
        result.put("replies", replies.getOrDefault(document.getObjectId("_id"), List.of()).stream()
                .map(reply -> decorate(reply, voted.contains(reply.get("_id")))).toList());
        return result;
    }
    private Map<String, Object> decorate(Document document, boolean recommended) {
        Map<String, Object> result = DocumentResponses.from(document); result.put("recommended", recommended); return result;
    }
    private Map<String, Object> voteResponse(String id, boolean recommended, Document comment) {
        return Map.of("commentId", id, "recommended", recommended, "recommendCount", comment.get("recommendCount", 0));
    }
}
