package com.anilist.server.global.web;

import com.anilist.server.global.cache.RedisStore;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class RequestProtectionFilter extends OncePerRequestFilter {
    private final Set<String> origins;
    private final RedisStore redis;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    public RequestProtectionFilter(Set<String> origins, RedisStore redis) { this.origins = Set.copyOf(origins); this.redis = redis; }
    private record Bucket(long count, long reset) {}
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        String origin = request.getHeader("Origin");
        boolean safe = Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod());
        response.addHeader("Vary", "Origin");
        if (origin != null && origins.contains(origin)) {
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
            response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        } else if (origin != null && !safe) { reject(response, 403, "허용되지 않은 요청 출처입니다."); return; }
        if (request.getMethod().equals("OPTIONS")) { response.setStatus(204); return; }
        String path = request.getRequestURI();
        if (path.startsWith("/user")) response.setHeader("Cache-Control", "no-store");
        if (request.getMethod().equals("POST")) {
            String group = switch (path) {
                case "/user/login" -> "login";
                case "/user/signup" -> "signup";
                case "/user/forgot-password", "/user/reset-password" -> "password-reset";
                default -> null;
            };
            if (group != null && !allow(group, request.getRemoteAddr(), response)) return;
        }
        if (!safe && request.getContentType() != null && request.getContentType().startsWith("application/json")) {
            byte[] body = request.getInputStream().readNBytes(102401);
            if (body.length > 102400) { reject(response, 413, "요청 본문이 너무 큽니다."); return; }
            chain.doFilter(new HttpServletRequestWrapper(request) {
                @Override public ServletInputStream getInputStream() {
                    ByteArrayInputStream input = new ByteArrayInputStream(body);
                    return new ServletInputStream() {
                        public int read() { return input.read(); }
                        public boolean isFinished() { return input.available() == 0; }
                        public boolean isReady() { return true; }
                        public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                    };
                }
                @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8)); }
            }, response);
        } else chain.doFilter(request, response);
    }
    private boolean allow(String group, String address, HttpServletResponse response) throws IOException {
        long now = System.currentTimeMillis(), window = group.equals("login") ? 900000 : 3600000;
        int limit = group.equals("login") ? 10 : 5;
        String key = group + ":" + address;
        buckets.entrySet().removeIf(entry -> entry.getValue().reset <= now);
        Bucket bucket = buckets.compute(key, (unused, old) -> old == null || old.reset <= now
                ? new Bucket(1, now + window) : new Bucket(old.count + 1, old.reset));
        Long shared = redis.consume("rate-limit:" + key, Duration.ofMillis(window));
        long count = shared == null ? bucket.count : shared;
        response.setHeader("RateLimit-Limit", Integer.toString(limit));
        response.setHeader("RateLimit-Remaining", Long.toString(Math.max(0, limit - count)));
        response.setHeader("RateLimit-Reset", Long.toString((bucket.reset + 999) / 1000));
        if (count <= limit) return true;
        response.setHeader("Retry-After", Long.toString(Math.max(1, (bucket.reset - now + 999) / 1000)));
        reject(response, 429, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."); return false;
    }
    private void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status); response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
