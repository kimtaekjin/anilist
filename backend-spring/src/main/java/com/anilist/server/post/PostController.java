package com.anilist.server.post;

import com.anilist.server.user.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/post")
public class PostController {
    private final PostService posts;
    private final AuthService auth;
    public PostController(PostService posts, AuthService auth) { this.posts = posts; this.auth = auth; }
    @GetMapping({"", "/"})
    public Object list(@RequestParam(required=false) String page, @RequestParam(required=false) String limit) { return posts.list(page, limit); }
    @PostMapping({"", "/"})
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        return ResponseEntity.status(201).body(posts.create(body, auth.require(request)));
    }
    @GetMapping("/{id}")
    public Object detail(@PathVariable String id, HttpServletRequest request) {
        return posts.detail(id, auth.optional(request), request.getRemoteAddr(), request.getHeader("User-Agent"));
    }
    @PutMapping("/{id}")
    public Object update(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return posts.update(id, body, auth.require(request));
    }
    @DeleteMapping("/{id}")
    public Object delete(@PathVariable String id, HttpServletRequest request) {
        posts.delete(id, auth.require(request)); return Map.of("message", "게시글을 삭제했습니다.");
    }
    @GetMapping("/{id}/comments")
    public Object comments(@PathVariable String id) { return posts.listComments(id); }
    @PostMapping("/{id}/comment")
    public ResponseEntity<?> addComment(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return ResponseEntity.status(201).body(posts.addComment(id, body, auth.require(request)));
    }
    @DeleteMapping("/{postId}/comment/{commentId}")
    public Object deleteComment(@PathVariable String postId, @PathVariable String commentId, HttpServletRequest request) {
        posts.deleteComment(postId, commentId, auth.require(request)); return Map.of("message", "댓글을 삭제했습니다.");
    }
}
