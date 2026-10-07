package com.anilist.server.user;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/user")
public class UserController {
    private final UserService users;
    private final AuthService auth;
    private final boolean secure;
    public UserController(UserService users, AuthService auth, @Value("${app.environment:development}") String environment) {
        this.users = users; this.auth = auth; this.secure = environment.equals("production");
    }
    private String cookie(String value, Duration age) {
        return ResponseCookie.from("token", value).httpOnly(true).secure(secure)
                .sameSite(secure ? "None" : "Strict").path("/").maxAge(age).build().toString();
    }
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, Object> body) {
        users.signup(body);
        return ResponseEntity.status(201).body(Map.of("message", "회원가입이 완료되었습니다."));
    }
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        var result = users.login(body);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(result.token(), Duration.ofDays(1)))
                .body(Map.of("user", result.user(), "message", "로그인되었습니다."));
    }
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO))
                .body(Map.of("message", "로그아웃되었습니다."));
    }
    @GetMapping("/verify-token")
    public Map<String, Object> verify(HttpServletRequest request) {
        return Map.of("isValid", true, "user", auth.require(request));
    }
    @PostMapping("/forgot-password")
    public Map<String, String> forgot(@RequestBody Map<String, Object> body) {
        users.forgot(body);
        return Map.of("message", "계정이 존재하면 비밀번호 재설정 메일을 발송합니다.");
    }
    @PostMapping("/reset-password")
    public ResponseEntity<?> reset(@RequestBody Map<String, Object> body) {
        users.reset(body);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO))
                .body(Map.of("message", "비밀번호가 성공적으로 변경되었습니다. 다시 로그인해 주세요."));
    }
    @DeleteMapping("/me")
    public ResponseEntity<?> deleteAccount(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        var user = auth.require(request);
        users.deleteAccount(user.userId(), body);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO))
                .body(Map.of("message", "회원 탈퇴가 완료되었습니다. 작성한 콘텐츠는 익명화되어 유지됩니다."));
    }
}
