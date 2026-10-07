package com.anilist.server.user;

import com.anilist.server.global.exception.ApiException;
import com.anilist.server.global.web.Inputs;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class UserService {
    private static final String LOGIN_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다.";
    private static final String DELETED_USER_ID = "deleted-user";
    private static final String DELETED_AUTHOR = "탈퇴한 사용자";
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(12);
    private final UserRepository users;
    private final MongoTemplate mongo;
    private final TokenService tokens;
    private final ResetMailer mailer;
    public UserService(UserRepository users, MongoTemplate mongo, TokenService tokens, ResetMailer mailer) {
        this.users = users; this.mongo = mongo; this.tokens = tokens; this.mailer = mailer;
    }
    public static boolean validPassword(String password) {
        return password != null && password.length() >= 8 && password.length() <= 72
                && password.getBytes(StandardCharsets.UTF_8).length <= 72
                && password.matches("(?s).*[A-Za-z].*") && password.matches("(?s).*[0-9].*");
    }
    private String email(Map<String, Object> body) { return Inputs.text(body, "email").toLowerCase(Locale.ROOT); }
    private boolean validEmail(String email) { return email.length() <= 254 && email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"); }
    public void signup(Map<String, Object> body) {
        String email = email(body), name = Inputs.text(body, "username"), password = Inputs.password(body);
        Inputs.require(validEmail(email) && name.length() >= 2 && name.length() <= 30
                && name.matches("[\\p{L}\\p{N}_-]+") && validPassword(password),
                "이메일, 닉네임(2~30자), 비밀번호(영문과 숫자를 포함한 8~72바이트)를 확인해 주세요.");
        Date now = new Date();
        try {
            mongo.insert(new Document("email", email).append("username", name).append("password", passwords.encode(password))
                    .append("admin", false).append("isActive", true).append("isLoggedIn", false)
                    .append("tokenVersion", 0).append("failedLoginAttempts", 0)
                    .append("createdAt", now).append("updatedAt", now), "users");
        } catch (DuplicateKeyException exception) { throw new ApiException(409, "이미 사용 중인 이메일 또는 닉네임입니다."); }
    }
    public LoginResult login(Map<String, Object> body) {
        String email = email(body), password = Inputs.password(body);
        if (!validEmail(email) || password.isEmpty() || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(401, LOGIN_ERROR);
        UserAccount user = users.findByEmail(email).orElseThrow(() -> new ApiException(401, LOGIN_ERROR));
        if (!Boolean.TRUE.equals(user.isActive())) throw new ApiException(401, LOGIN_ERROR);
        Instant now = Instant.now();
        if (user.failures() >= 5 && user.lastLoginAttempt() != null && user.lastLoginAttempt().isAfter(now.minusSeconds(900)))
            throw new ApiException(429, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        Query identity = query(where("_id").is(new ObjectId(user.id())).and("password").is(user.password()));
        if (!passwords.matches(password, user.password())) {
            Update failure = new Update().set("lastLoginAttempt", Date.from(now)).set("updatedAt", Date.from(now));
            if (user.failures() >= 5) failure.set("failedLoginAttempts", 1); else failure.inc("failedLoginAttempts", 1);
            mongo.updateFirst(identity, failure, "users");
            throw new ApiException(401, LOGIN_ERROR);
        }
        mongo.updateFirst(identity, new Update().set("failedLoginAttempts", 0)
                .set("lastLoginAttempt", Date.from(now)).set("updatedAt", Date.from(now)), "users");
        return new LoginResult(tokens.issue(user), user.publicUser());
    }
    public void forgot(Map<String, Object> body) {
        String email = email(body);
        Inputs.require(validEmail(email), "올바른 이메일을 입력해 주세요.");
        UserAccount user = users.findByEmail(email).orElse(null);
        if (user == null) return;
        byte[] random = new byte[32]; new SecureRandom().nextBytes(random);
        String rawToken = HexFormat.of().formatHex(random), hash = sha256(rawToken);
        Query identity = query(where("_id").is(new ObjectId(user.id())));
        mongo.updateFirst(identity, new Update().set("resetPasswordToken", hash)
                .set("resetPasswordExpire", Date.from(Instant.now().plusSeconds(600))).set("updatedAt", new Date()), "users");
        try { mailer.send(email, rawToken); }
        catch (RuntimeException exception) {
            mongo.updateFirst(query(where("_id").is(new ObjectId(user.id())).and("resetPasswordToken").is(hash)),
                    new Update().unset("resetPasswordToken").unset("resetPasswordExpire"), "users");
            throw new ApiException(503, "메일을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
    }
    public void reset(Map<String, Object> body) {
        String token = Inputs.text(body, "token"), password = Inputs.password(body);
        Inputs.require(!token.isBlank() && validPassword(password), "재설정 토큰과 새 비밀번호를 확인해 주세요.");
        // Match and consume in one operation: simultaneous reset requests cannot reuse the token.
        Document changed = mongo.findAndModify(query(where("resetPasswordToken").is(sha256(token))
                        .and("resetPasswordExpire").gt(new Date())),
                new Update().set("password", passwords.encode(password)).unset("resetPasswordToken")
                        .unset("resetPasswordExpire").inc("tokenVersion", 1).set("failedLoginAttempts", 0)
                        .set("updatedAt", new Date()), FindAndModifyOptions.options().returnNew(true), Document.class, "users");
        if (changed == null) throw new ApiException(400, "토큰이 유효하지 않거나 만료되었습니다.");
    }
    @Transactional(transactionManager = "mongoTransactionManager")
    public void deleteAccount(String userId, Map<String, Object> body) {
        String password = Inputs.password(body);
        if (password.isBlank() || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(400, "탈퇴하려면 현재 비밀번호를 입력해 주세요.");

        UserAccount user = users.findById(userId)
                .orElseThrow(() -> new ApiException(401, "로그인이 필요합니다."));
        if (!passwords.matches(password, user.password()))
            throw new ApiException(401, "비밀번호가 올바르지 않습니다.");

        anonymizeAuthoredContent(userId);
        removeVotesAndRecount(userId);
        mongo.remove(query(where("_id").is(new ObjectId(userId))), "users");
    }

    private void anonymizeAuthoredContent(String userId) {
        Update postAuthor = new Update()
                .set("userId", DELETED_USER_ID)
                .set("author", DELETED_AUTHOR);
        mongo.updateMulti(query(where("userId").is(userId)), postAuthor, "posts");

        Update postComments = new Update()
                .set("comments.$[comment].userId", DELETED_USER_ID)
                .set("comments.$[comment].author", DELETED_AUTHOR)
                .filterArray(where("comment.userId").is(userId));
        mongo.updateMulti(query(where("comments.userId").is(userId)), postComments, "posts");

        Update animeComments = new Update()
                .set("userId", DELETED_USER_ID)
                .set("author", DELETED_AUTHOR);
        mongo.updateMulti(query(where("userId").is(userId)), animeComments, "animecomments");
        mongo.updateMulti(query(where("userId").is(userId)), animeComments, "postcomments");
    }

    private void removeVotesAndRecount(String userId) {
        removeVotesAndRecount(userId, "animecommentvotes", "animecomments");
        removeVotesAndRecount(userId, "postcommentvotes", "postcomments");
    }

    private void removeVotesAndRecount(String userId, String voteCollection, String commentCollection) {
        Query userVotes = query(where("userId").is(userId));
        Set<ObjectId> affectedComments = mongo.find(userVotes, Document.class, voteCollection).stream()
                .map(vote -> vote.get("commentId"))
                .filter(ObjectId.class::isInstance)
                .map(ObjectId.class::cast)
                .collect(java.util.stream.Collectors.toSet());

        mongo.remove(userVotes, voteCollection);

        for (ObjectId commentId : affectedComments) {
            long count = mongo.count(query(where("commentId").is(commentId)), voteCollection);
            mongo.updateFirst(query(where("_id").is(commentId)),
                    new Update().set("recommendCount", count).set("updatedAt", new Date()), commentCollection);
        }
    }

    public static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    public record LoginResult(String token, UserAccount.AuthUser user) {}
}
