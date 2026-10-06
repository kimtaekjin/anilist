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
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class AnimeCommentService {
    private static final String COMMENTS = "animecomments", VOTES = "animecommentvotes";
    private final DocumentStore store;
    private final AnimeRepository anime;
    public AnimeCommentService(DocumentStore store, AnimeRepository anime) { this.store = store; this.anime = anime; }
    private void validAnime(int id) { Inputs.require(id > 0, "올바르지 않은 애니 ID입니다."); }
    public Object list(int animeId, String requestedPage, String requestedLimit, AuthUser viewer) {
        validAnime(animeId);
        int page = Inputs.page(requestedPage, 1, Integer.MAX_VALUE), limit = Inputs.page(requestedLimit, 10, 30);
        List<Document> top = store.list(COMMENTS, query(where("animeId").is(animeId).and("recommendCount").gt(0))
                .with(Sort.by(Sort.Order.desc("recommendCount"), Sort.Order.desc("createdAt"))).limit(3));
        List<Object> topIds = top.stream().map(doc -> doc.get("_id")).toList();
        Criteria regular = where("animeId").is(animeId).and("_id").nin(topIds);
        List<Document> comments = store.list(COMMENTS, query(regular).with(Sort.by(Sort.Direction.DESC, "createdAt"))
                .skip((long)(page - 1) * limit).limit(limit));
        long total = store.count(COMMENTS, query(regular));
        List<Document> all = new ArrayList<>(top); all.addAll(comments);
        Set<Object> voted = viewer == null || all.isEmpty() ? Set.of() : store.list(VOTES,
                query(where("commentId").in(all.stream().map(d -> d.get("_id")).toList()).and("userId").is(viewer.userId())))
                .stream().map(d -> d.get("commentId")).collect(Collectors.toSet());
        return Map.of("topComments", top.stream().map(d -> decorate(d, voted.contains(d.get("_id")))).toList(),
                "comments", comments.stream().map(d -> decorate(d, voted.contains(d.get("_id")))).toList(),
                "total", total, "page", page, "limit", limit, "totalPages", (total + limit - 1) / limit);
    }
    public Object create(int animeId, Map<String, Object> body, AuthUser user) {
        validAnime(animeId);
        String content = Inputs.text(body, "content");
        Inputs.require(!content.isEmpty() && content.length() <= 1000, "댓글은 1~1000자로 입력해 주세요.");
        if (!anime.existsById(animeId)) throw new ApiException(404, "애니 정보를 찾을 수 없습니다.");
        Document comment = store.insert(COMMENTS, new Document("animeId", animeId).append("userId", user.userId())
                .append("author", user.userName()).append("content", content).append("recommendCount", 0)
                .append("createdAt", new Date()).append("updatedAt", new Date()));
        return decorate(comment, false);
    }
    public Object delete(int animeId, String commentId, AuthUser user) {
        validAnime(animeId); ObjectId id = Inputs.objectId(commentId);
        Document deleted = store.remove(COMMENTS, query(where("_id").is(id).and("animeId").is(animeId).and("userId").is(user.userId())));
        if (deleted == null) {
            if (store.find(COMMENTS, identity(animeId, id)) == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
            throw new ApiException(403, "본인이 작성한 댓글만 삭제할 수 있습니다.");
        }
        store.removeMany(VOTES, query(where("commentId").is(id)));
        return Map.of("commentId", commentId, "message", "댓글을 삭제했습니다.");
    }
    public Object recommend(int animeId, String commentId, AuthUser user, boolean recommend) {
        validAnime(animeId); ObjectId id = Inputs.objectId(commentId);
        Document current = store.find(COMMENTS, identity(animeId, id));
        if (current == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
        Query voteQuery = query(where("commentId").is(id).and("userId").is(user.userId()));
        Document vote = new Document("commentId", id).append("userId", user.userId())
                .append("createdAt", new Date()).append("updatedAt", new Date());
        if (recommend) {
            try { store.insert(VOTES, vote); }
            catch (DuplicateKeyException duplicate) {
                Document latest = store.find(COMMENTS, identity(animeId, id));
                if (latest == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
                return voteResponse(commentId, true, latest);
            }
            try {
                Document updated = store.update(COMMENTS, identity(animeId, id),
                        new Update().inc("recommendCount", 1).set("updatedAt", new Date()), false);
                if (updated == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
                return voteResponse(commentId, true, updated);
            } catch (RuntimeException failure) { store.remove(VOTES, voteQuery); throw failure; }
        }
        Document removed = store.remove(VOTES, voteQuery);
        if (removed == null) return voteResponse(commentId, false, current);
        try {
            // Protect legacy/inconsistent counters from going negative.
            Document updated = store.update(COMMENTS, query(where("_id").is(id).and("animeId").is(animeId).and("recommendCount").gt(0)),
                    new Update().inc("recommendCount", -1).set("updatedAt", new Date()), false);
            if (updated == null) updated = store.find(COMMENTS, identity(animeId, id));
            if (updated == null) throw new ApiException(404, "댓글을 찾을 수 없습니다.");
            return voteResponse(commentId, false, updated);
        } catch (RuntimeException failure) {
            if (!(failure instanceof ApiException)) {
                try { store.insert(VOTES, removed); } catch (DuplicateKeyException ignored) { }
            }
            throw failure;
        }
    }
    private Query identity(int animeId, ObjectId id) { return query(where("_id").is(id).and("animeId").is(animeId)); }
    private Map<String, Object> decorate(Document document, boolean recommended) {
        Map<String, Object> result = DocumentResponses.from(document); result.put("recommended", recommended); return result;
    }
    private Map<String, Object> voteResponse(String id, boolean recommended, Document comment) {
        return Map.of("commentId", id, "recommended", recommended, "recommendCount", comment.get("recommendCount", 0));
    }
}
