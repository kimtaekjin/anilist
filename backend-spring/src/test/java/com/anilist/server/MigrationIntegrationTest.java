package com.anilist.server;

import com.anilist.server.user.ResetMailer;
import com.anilist.server.user.UserService;
import com.anilist.server.anime.sync.ExternalJsonClient;
import com.fasterxml.jackson.databind.*;
import de.bwaldvogel.mongo.MongoServer;
import de.bwaldvogel.mongo.backend.memory.MemoryBackend;
import jakarta.servlet.http.Cookie;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/** Full Spring HTTP/service/repository flow against an isolated Mongo wire-protocol emulator. */
@SpringBootTest(properties={"app.jwt-secret=test-only-secret-at-least-32-bytes-long", "app.redis-enabled=false",
        "app.sync.enabled=false", "app.environment=development", "ANILIST_MIN_REQUEST_INTERVAL_MS=1", "ANILIST_MAX_RETRIES=0"})
@AutoConfigureMockMvc
class MigrationIntegrationTest {
    static final MongoServer DATABASE = new MongoServer(new MemoryBackend());
    static final String URI = DATABASE.bindAndGetConnectionString() + "/migration_test";
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) { registry.add("spring.data.mongodb.uri", () -> URI); }
    @AfterAll static void stop() { DATABASE.shutdownNow(); }
    @Autowired MockMvc mvc;
    @Autowired MongoTemplate mongo;
    @Autowired ObjectMapper json;
    @MockitoBean ResetMailer mail;
    @MockitoBean ExternalJsonClient external;
    private int requestId;
    @BeforeEach void clean() {
        for (String collection : List.of("users", "posts", "counters", "animecomments", "animecommentvotes", "animes", "translations"))
            mongo.getCollection(collection).deleteMany(new Document());
        requestId = new Random().nextInt(100000);
    }
    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder) {
        return builder.with(req -> { req.setRemoteAddr("test-" + requestId++); return req; });
    }
    private String body(Object value) throws Exception { return json.writeValueAsString(value); }
    private Cookie signupLogin(String email, String username) throws Exception {
        mvc.perform(request(post("/user/signup")).contentType("application/json").content(body(Map.of("email", email, "username", username, "password", "Password123"))))
                .andExpect(status().isCreated());
        var response = mvc.perform(request(post("/user/login")).contentType("application/json").content(body(Map.of("email", email, "password", "Password123"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.userId").isString())
                .andExpect(jsonPath("$.user.password").doesNotExist()).andReturn().getResponse();
        String cookie = response.getHeader("Set-Cookie");
        assertThat(cookie).contains("HttpOnly", "SameSite=Strict", "Path=/");
        return new Cookie("token", cookie.substring(6, cookie.indexOf(';')));
    }
    @Test void signupLoginDuplicateAndLogout() throws Exception {
        Cookie cookie = signupLogin("A@example.com", "첫사용자");
        mvc.perform(get("/user/verify-token").cookie(cookie)).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("a@example.com"));
        Document saved = mongo.getCollection("users").find().first();
        assertThat(saved.getString("password")).startsWith("$2a$12$");
        mvc.perform(request(post("/user/signup")).contentType("application/json").content(body(Map.of("email", "a@example.com", "username", "다른이름", "password", "Password123"))))
                .andExpect(status().isConflict());
        mvc.perform(post("/user/logout").cookie(cookie)).andExpect(status().isOk()).andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));
        mvc.perform(get("/user/verify-token").cookie(new Cookie("token", cookie.getValue()+"x"))).andExpect(status().isUnauthorized());
    }
    @Test void resetIsSingleUseAndInvalidatesExistingJwt() throws Exception {
        Cookie cookie = signupLogin("reset@example.com", "재설정사용자");
        mvc.perform(request(post("/user/forgot-password")).contentType("application/json").content("{\"email\":\"reset@example.com\"}"))
                .andExpect(status().isOk());
        ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq("reset@example.com"), token.capture());
        assertThat(mongo.getCollection("users").find().first().getString("resetPasswordToken")).isEqualTo(UserService.sha256(token.getValue()));
        String reset = body(Map.of("token", token.getValue(), "password", "ChangedPassword123"));
        mvc.perform(request(post("/user/reset-password")).contentType("application/json").content(reset)).andExpect(status().isOk());
        mvc.perform(get("/user/verify-token").cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(request(post("/user/reset-password")).contentType("application/json").content(reset)).andExpect(status().isBadRequest());
        mvc.perform(request(post("/user/login")).contentType("application/json").content(body(Map.of("email", "reset@example.com", "password", "ChangedPassword123"))))
                .andExpect(status().isOk());
    }
    @Test void locksAccountAfterFiveFailuresAcrossDifferentAddresses() throws Exception {
        signupLogin("lock@example.com", "잠금사용자");
        for (int i=0;i<5;i++) mvc.perform(request(post("/user/login")).contentType("application/json")
                .content("{\"email\":\"lock@example.com\",\"password\":\"WrongPassword123\"}")).andExpect(status().isUnauthorized());
        mvc.perform(request(post("/user/login")).contentType("application/json")
                .content("{\"email\":\"lock@example.com\",\"password\":\"Password123\"}")).andExpect(status().isTooManyRequests());
    }
    @Test void postOwnershipCommentsAndPagination() throws Exception {
        Cookie owner = signupLogin("owner@example.com", "글작성자"), stranger = signupLogin("other@example.com", "다른사용자");
        String payload = body(Map.of("title", "게시글 제목", "content", "테스트 게시글의 본문입니다.", "userId", "forged", "isNotice", true));
        var created = mvc.perform(post("/post").cookie(owner).contentType("application/json").content(payload))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.isNotice").value(false))
                .andExpect(jsonPath("$.author").value("글작성자")).andReturn();
        String id = json.readTree(created.getResponse().getContentAsString()).path("_id").asText();
        assertThat(ObjectId.isValid(id)).isTrue();
        mvc.perform(put("/post/"+id).cookie(stranger).contentType("application/json").content(payload)).andExpect(status().isForbidden());
        mvc.perform(put("/post/"+id).cookie(owner).contentType("application/json").content(payload)).andExpect(status().isOk());
        var comment = mvc.perform(post("/post/"+id+"/comment").cookie(owner).contentType("application/json").content("{\"content\":\"댓글\"}"))
                .andExpect(status().isCreated()).andReturn();
        String commentId = json.readTree(comment.getResponse().getContentAsString()).path("_id").asText();
        mvc.perform(get("/post/").param("limit", "1")).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].commentCount").value(1));
        mvc.perform(get("/post/"+id)).andExpect(status().isOk()).andExpect(jsonPath("$.views").value(1))
                .andExpect(jsonPath("$.comments").doesNotExist()).andExpect(jsonPath("$.viewLogs").doesNotExist());
        mvc.perform(delete("/post/"+id+"/comment/"+commentId).cookie(stranger)).andExpect(status().isForbidden());
        mvc.perform(delete("/post/"+id+"/comment/"+commentId).cookie(owner)).andExpect(status().isOk());
        mvc.perform(delete("/post/"+id).cookie(stranger)).andExpect(status().isForbidden());
        mvc.perform(delete("/post/"+id).cookie(owner)).andExpect(status().isOk());
        mvc.perform(get("/post/"+id)).andExpect(status().isNotFound());
    }
    @Test void animeRecommendationIsIdempotentAndScopedToAnime() throws Exception {
        Cookie owner = signupLogin("comment@example.com", "댓글작성자"), other = signupLogin("vote@example.com", "추천사용자");
        mongo.getCollection("animes").insertOne(new Document("_id", 1));
        var response = mvc.perform(post("/anime-comments/1").cookie(owner).contentType("application/json").content("{\"content\":\"재미있어요\"}"))
                .andExpect(status().isCreated()).andReturn();
        String id = json.readTree(response.getResponse().getContentAsString()).path("_id").asText();
        for (int i=0;i<2;i++) mvc.perform(put("/anime-comments/1/"+id+"/recommend").cookie(other))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recommendCount").value(1));
        mvc.perform(get("/anime-comments/1").cookie(other)).andExpect(status().isOk())
                .andExpect(jsonPath("$.topComments[0].recommended").value(true)).andExpect(jsonPath("$.comments.length()").value(0));
        mvc.perform(delete("/anime-comments/2/"+id+"/recommend").cookie(other)).andExpect(status().isNotFound());
        assertThat(mongo.getCollection("animecommentvotes").countDocuments()).isEqualTo(1);
        for (int i=0;i<2;i++) mvc.perform(delete("/anime-comments/1/"+id+"/recommend").cookie(other))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recommendCount").value(0));
        mvc.perform(delete("/anime-comments/1/"+id).cookie(other)).andExpect(status().isForbidden());
        mvc.perform(delete("/anime-comments/1/"+id).cookie(owner)).andExpect(status().isOk());
    }
    @Test void protectsOriginBodySizeAndUnauthenticatedWrites() throws Exception {
        mvc.perform(post("/post").header("Origin", "https://evil.example").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/post").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(options("/post").header("Origin", "http://localhost:3000").header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isNoContent()).andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(post("/post").contentType("application/json").content("x".repeat(102401))).andExpect(status().isPayloadTooLarge());
    }
    @Test void missingDetailFetchesAndPreservesCharacters() throws Exception {
        JsonNode media = json.readTree("""
            {"data":{"Media":{"id":42,"title":{"native":"한국어 제목"},"description":"한국어 줄거리",
            "format":"TV","coverImage":{"large":"https://example.com/image.jpg"},"genres":["Action"],
            "characters":{"edges":[{"role":"MAIN","node":{"id":2,"name":{"full":"Name","native":"이름"},"image":{"large":"image"}}}]},
            "trailer":{"id":"video","site":"youtube"}}}}
            """);
        when(external.post(eq("https://graphql.anilist.co"), any(), any())).thenReturn(new ExternalJsonClient.Result(200, media, ""));
        mvc.perform(get("/service/anime/detail/42")).andExpect(status().isOk())
                .andExpect(jsonPath("$._id").value(42)).andExpect(jsonPath("$.characters[0].name.native").value("이름"))
                .andExpect(jsonPath("$.trailer.id").value("video")).andExpect(jsonPath("$.genres[0]").value("액션"));
        assertThat(mongo.getCollection("animes").countDocuments(new Document("_id",42))).isEqualTo(1);
    }

    @Test void enforcesIpRateLimitWithoutRedis() throws Exception {
        String address = "rate-test-" + UUID.randomUUID();
        for (int i=0; i<10; i++) mvc.perform(post("/user/login").with(r -> { r.setRemoteAddr(address); return r; })
                .contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/user/login").with(r -> { r.setRemoteAddr(address); return r; })
                .contentType("application/json").content("{}"))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
    }

    @Test void inactiveUserAndChangedAdminClaimsAreReadFromDatabase() throws Exception {
        Cookie cookie = signupLogin("active@example.com", "활성사용자");
        mongo.getCollection("users").updateOne(new Document("email", "active@example.com"), new Document("$set", new Document("admin", true)));
        mvc.perform(get("/user/verify-token").cookie(cookie)).andExpect(status().isOk()).andExpect(jsonPath("$.user.admin").value(true));
        mongo.getCollection("users").updateOne(new Document("email", "active@example.com"), new Document("$set", new Document("isActive", false)));
        mvc.perform(get("/user/verify-token").cookie(cookie)).andExpect(status().isUnauthorized());
    }
}
