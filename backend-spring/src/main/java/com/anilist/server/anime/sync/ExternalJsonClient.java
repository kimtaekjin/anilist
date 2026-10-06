package com.anilist.server.anime.sync;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;

@Component
public class ExternalJsonClient {
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    public ExternalJsonClient(ObjectMapper mapper) { this.mapper = mapper; }
    public Result post(String url, Object body, Map<String, String> headers) {
        try {
            var builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json").header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
            headers.forEach(builder::header);
            HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode json;
            try { json = mapper.readTree(response.body()); } catch (Exception invalid) { json = mapper.createObjectNode(); }
            return new Result(response.statusCode(), json, response.headers().firstValue("retry-after").orElse(""));
        } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new IllegalStateException("Request interrupted"); }
        catch (Exception failure) { throw new IllegalStateException("External request failed", failure); }
    }
    public record Result(int status, JsonNode body, String retryAfter) {}
    public JsonNode get(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/sparql-results+json").header("User-Agent", "AniwikiLocalizationAudit/1.0").GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("External GET returned " + response.statusCode());
            return mapper.readTree(response.body());
        } catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new IllegalStateException("Request interrupted"); }
        catch (Exception failure) { throw new IllegalStateException("External GET failed", failure); }
    }
    static void pause(long milliseconds) {
        if (milliseconds <= 0) return;
        try { Thread.sleep(milliseconds); }
        catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new IllegalStateException("Request interrupted"); }
    }
}
