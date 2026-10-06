package com.anilist.server.global.web;

import com.anilist.server.global.cache.RedisStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;
import java.util.*;

@Configuration
public class WebConfiguration {
    @Bean
    FilterRegistrationBean<RequestProtectionFilter> requestProtection(RedisStore redis,
            @Value("${app.client-url:}") String client,
            @Value("${app.cors-origins:}") String origins,
            @Value("${app.environment:development}") String environment) {
        Set<String> allowed = new HashSet<>();
        for (String origin : (client + "," + origins).split(",")) if (!origin.isBlank()) allowed.add(origin.trim());
        if (!environment.equals("production")) allowed.add("http://localhost:3000");
        var registration = new FilterRegistrationBean<>(new RequestProtectionFilter(allowed, redis));
        registration.setOrder(-100);
        return registration;
    }
}
