package com.anilist.server.user;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.anilist.server.global.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
public class TokenService {
    private final byte[] secret;
    public TokenService(@Value("${app.jwt-secret:}") String secret) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }
    private void requireConfigured() {
        if (secret.length < 32) throw new ApiException(503, "JWT_SECRET은 32바이트 이상으로 설정해야 합니다.");
    }
    public String issue(UserAccount user) {
        requireConfigured();
        try {
            Instant now = Instant.now();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), new JWTClaimsSet.Builder()
                    .claim("userId", user.id()).claim("email", user.email()).claim("userName", user.username())
                    .claim("admin", Boolean.TRUE.equals(user.admin())).claim("tokenVersion", user.version())
                    .issueTime(Date.from(now)).expirationTime(Date.from(now.plusSeconds(86400))).build());
            jwt.sign(new MACSigner(secret));
            return jwt.serialize();
        } catch (JOSEException exception) { throw new IllegalStateException("JWT signing failed", exception); }
    }
    public JWTClaimsSet verify(String token) {
        requireConfigured();
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(new MACVerifier(secret)))
                throw new IllegalArgumentException();
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            if (claims.getExpirationTime() == null || !claims.getExpirationTime().after(new Date())
                    || (claims.getNotBeforeTime() != null && claims.getNotBeforeTime().after(new Date()))
                    || claims.getStringClaim("userId") == null) throw new IllegalArgumentException();
            return claims;
        } catch (Exception exception) { throw new ApiException(401, "유효하지 않은 로그인 정보입니다."); }
    }
}
