package com.anilist.server.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;

/** Fails fast when a production process would start with unsafe defaults. */
@Component
public class ProductionConfigurationValidator implements ApplicationRunner {
    private final String environment;
    private final String jwtSecret;
    private final String mongoUri;
    private final String clientUrl;
    private final boolean redisEnabled;
    private final String redisUrl;

    public ProductionConfigurationValidator(
            @Value("${app.environment:development}") String environment,
            @Value("${app.jwt-secret:}") String jwtSecret,
            @Value("${spring.data.mongodb.uri:}") String mongoUri,
            @Value("${app.client-url:}") String clientUrl,
            @Value("${app.redis-enabled:false}") boolean redisEnabled,
            @Value("${spring.data.redis.url:}") String redisUrl) {
        this.environment = environment;
        this.jwtSecret = jwtSecret;
        this.mongoUri = mongoUri;
        this.clientUrl = clientUrl;
        this.redisEnabled = redisEnabled;
        this.redisUrl = redisUrl;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!"production".equalsIgnoreCase(environment)) return;
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes in production");
        if (mongoUri.isBlank() || mongoUri.contains("127.0.0.1") || mongoUri.contains("localhost"))
            throw new IllegalStateException("MONGO_URI must point to the production MongoDB in production");
        if (!clientUrl.startsWith("https://"))
            throw new IllegalStateException("CLIENT_URL must use HTTPS in production");
        if (redisEnabled && (redisUrl.isBlank() || redisUrl.contains("localhost") || redisUrl.contains("127.0.0.1")))
            throw new IllegalStateException("REDIS_URL must point to the production Redis in production");
    }
}
