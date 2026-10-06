package com.anilist.server.user;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document("users")
public record UserAccount(@Id String id, String email, String username, String password,
                          Boolean admin, Boolean isActive, Integer tokenVersion,
                          Integer failedLoginAttempts, Instant lastLoginAttempt) {
    public int version() { return tokenVersion == null ? 0 : tokenVersion; }
    public int failures() { return failedLoginAttempts == null ? 0 : failedLoginAttempts; }
    public AuthUser publicUser() { return new AuthUser(id, email, username, Boolean.TRUE.equals(admin)); }
    public record AuthUser(String userId, String email, String userName, boolean admin) {}
}
