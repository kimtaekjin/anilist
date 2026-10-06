package com.anilist.server.user;

import com.anilist.server.global.exception.ApiException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import java.util.Arrays;

@Service
public class AuthService {
    private final UserRepository users;
    private final TokenService tokens;
    public AuthService(UserRepository users, TokenService tokens) { this.users = users; this.tokens = tokens; }
    public UserAccount.AuthUser require(HttpServletRequest request) {
        UserAccount.AuthUser user = optional(request);
        if (user == null) throw new ApiException(401, "로그인이 필요합니다.");
        return user;
    }
    public UserAccount.AuthUser optional(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        String token = Arrays.stream(request.getCookies()).filter(c -> c.getName().equals("token"))
                .map(Cookie::getValue).findFirst().orElse(null);
        if (token == null) return null;
        try {
            var claims = tokens.verify(token);
            UserAccount user = users.findById(claims.getStringClaim("userId")).orElse(null);
            Integer version = claims.getIntegerClaim("tokenVersion");
            if (user == null || !Boolean.TRUE.equals(user.isActive()) || user.version() != (version == null ? 0 : version))
                return null;
            return user.publicUser();
        } catch (java.text.ParseException exception) { return null; }
        catch (ApiException exception) { if (exception.status() == 401) return null; throw exception; }
    }
}
