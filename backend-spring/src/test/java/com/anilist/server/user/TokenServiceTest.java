package com.anilist.server.user;

import com.anilist.server.global.exception.ApiException;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Date;
import static org.assertj.core.api.Assertions.*;

class TokenServiceTest {
    private static final String SECRET = "test-only-secret-at-least-32-bytes-long";
    @Test void rejectsExpiredAndWrongAlgorithmTokens() throws Exception {
        TokenService tokens = new TokenService(SECRET);
        SignedJWT expired = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), new JWTClaimsSet.Builder()
                .claim("userId", "0123456789abcdef01234567").expirationTime(Date.from(Instant.now().minusSeconds(1))).build());
        expired.sign(new MACSigner(SECRET));
        assertThatThrownBy(() -> tokens.verify(expired.serialize())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> tokens.verify("eyJhbGciOiJub25lIn0.e30.")).isInstanceOf(ApiException.class);
    }
    @Test void tokensContainVersionAndExpireInOneDay() throws Exception {
        TokenService tokens = new TokenService(SECRET);
        var user = new UserAccount("0123456789abcdef01234567", "test@example.com", "테스트", "hash", false, true, 3, 0, null);
        JWTClaimsSet claims = tokens.verify(tokens.issue(user));
        assertThat(claims.getIntegerClaim("tokenVersion")).isEqualTo(3);
        assertThat(claims.getExpirationTime().getTime()-claims.getIssueTime().getTime()).isEqualTo(86400000);
        assertThat(claims.getClaims()).doesNotContainKey("password");
    }
    @Test void checksBcryptByteLimitBeforeHashing() {
        assertThat(UserService.validPassword("한".repeat(30)+"Abc12345")).isFalse();
        assertThat(UserService.validPassword("Valid123")).isTrue();
    }
}
