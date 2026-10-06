package com.anilist.server.comment;

import com.anilist.server.user.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/anime-comments")
public class AnimeCommentController {
    private final AnimeCommentService comments;
    private final AuthService auth;
    public AnimeCommentController(AnimeCommentService comments, AuthService auth) { this.comments = comments; this.auth = auth; }
    @GetMapping("/{animeId}")
    public Object list(@PathVariable int animeId, @RequestParam(required=false) String page,
                       @RequestParam(required=false) String limit, HttpServletRequest request) {
        return comments.list(animeId, page, limit, auth.optional(request));
    }
    @PostMapping("/{animeId}")
    public ResponseEntity<?> create(@PathVariable int animeId, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return ResponseEntity.status(201).body(comments.create(animeId, body, auth.require(request)));
    }
    @DeleteMapping("/{animeId}/{commentId}")
    public Object delete(@PathVariable int animeId, @PathVariable String commentId, HttpServletRequest request) {
        return comments.delete(animeId, commentId, auth.require(request));
    }
    @PutMapping("/{animeId}/{commentId}/recommend")
    public Object recommend(@PathVariable int animeId, @PathVariable String commentId, HttpServletRequest request) {
        return comments.recommend(animeId, commentId, auth.require(request), true);
    }
    @DeleteMapping("/{animeId}/{commentId}/recommend")
    public Object cancel(@PathVariable int animeId, @PathVariable String commentId, HttpServletRequest request) {
        return comments.recommend(animeId, commentId, auth.require(request), false);
    }
}
