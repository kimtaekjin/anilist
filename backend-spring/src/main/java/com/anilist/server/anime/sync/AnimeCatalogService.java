package com.anilist.server.anime.sync;

import com.anilist.server.anime.domain.AnimeDocument;
import com.anilist.server.anime.dto.AnimeDetailResponse;
import com.anilist.server.anime.repository.AnimeRepository;
import com.anilist.server.anime.service.AnimeCache;
import com.anilist.server.global.data.DocumentStore;
import com.anilist.server.global.exception.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

@Service
public class AnimeCatalogService {
    private static final String FIELDS = """
        id idMal updatedAt format title { romaji english native }
        description coverImage { large extraLarge } bannerImage genres
        startDate { year month day } season seasonYear episodes status averageScore popularity
        studios(isMain: true) { nodes { name } } nextAiringEpisode { episode airingAt }
        trailer { id site } characters(sort: ROLE, perPage: 6) {
          edges { role node { id name { full native } image { large } } }
        }
        """;
    private final AniListClient client;
    private final TranslationService translations;
    private final DocumentStore store;
    private final MongoTemplate mongo;
    private final AnimeRepository repository;
    private final AnimeCache cache;
    public AnimeCatalogService(AniListClient client, TranslationService translations, DocumentStore store,
                               MongoTemplate mongo, AnimeRepository repository, AnimeCache cache) {
        this.client = client; this.translations = translations; this.store = store;
        this.mongo = mongo; this.repository = repository; this.cache = cache;
    }
    public AnimeDocument fetchDetail(int id) {
        JsonNode media = client.request("query($id:Int!){Media(id:$id,type:ANIME){" + FIELDS + "}}", Map.of("id", id)).path("Media");
        if (media.isMissingNode() || media.isNull()) throw new ApiException(404, "애니를 찾을 수 없습니다.");
        persist(media, "detail"); cache.invalidate();
        return repository.findById(id).orElseThrow(() -> new ApiException(502, "애니 저장 결과를 찾을 수 없습니다."));
    }
    public AnimeDetailResponse localize(AnimeDetailResponse value) {
        String title = value.title();
        if (title != null && !title.matches("(?s).*[가-힣].*") && title.matches("(?s).*[\\u3040-\\u30ff\\u3400-\\u9fff].*"))
            title = translations.translate(title, "title");
        List<AnimeDocument.AnimeCharacter> sourceCharacters = value.characters() == null ? List.of() : value.characters();
        List<String> characterNames = sourceCharacters.stream()
                .map(character -> character.name() == null ? "" : character.name().nativeTitle()).toList();
        List<String> translatedNames = translations.translateCharacters(characterNames);
        List<AnimeDocument.AnimeCharacter> characters = new ArrayList<>();
        for (int i = 0; i < sourceCharacters.size(); i++) {
            AnimeDocument.AnimeCharacter character = sourceCharacters.get(i);
            characters.add(new AnimeDocument.AnimeCharacter(character.anilistId(), character.role(),
                    character.name() == null ? null : new AnimeDocument.CharacterName(character.name().full(), translatedNames.get(i)), character.image()));
        }
        return new AnimeDetailResponse(value.id(), value.idMal(), value.type(), title, value.originalTitle(),
                translations.translate(value.description(), "synopsis"), value.image(), value.bannerImage(),
                value.genres() == null ? List.of() : value.genres().stream().map(translations::genre).toList(),
                value.days(), value.startDate(), value.season(), value.seasonYear(), value.episodes(), value.status(),
                value.averageScore(), value.popularity(), value.studio() == null || value.studio().isEmpty() ? List.of("미정") : value.studio(),
                value.nextAiringEpisode(), value.trailer(), characters);
    }
    public int sync(String type, String season, int year, boolean allPages) {
        String filter = switch (type) {
            case "trending" -> "format:TV,sort:POPULARITY_DESC";
            case "completed" -> "format:TV,status:FINISHED,sort:SCORE_DESC";
            case "ova" -> "format_in:[OVA,MOVIE],status:FINISHED,sort:POPULARITY_DESC";
            case "airing" -> "status:RELEASING,season:$season,seasonYear:$year";
            case "upcoming" -> "status:NOT_YET_RELEASED,sort:POPULARITY_DESC";
            case "genre" -> "season:$season,seasonYear:$year,sort:ID";
            default -> throw new IllegalArgumentException("Unknown catalog type");
        };
        boolean seasonal = type.equals("genre") || type.equals("airing");
        String variables = "$page:Int" + (seasonal ? ",$season:MediaSeason,$year:Int" : "");
        String gql = "query(" + variables + "){Page(page:$page,perPage:50){pageInfo{hasNextPage}media(type:ANIME," + filter + "){" + FIELDS + "}}}";
        Set<Integer> ids = new HashSet<>();
        int maxPages = Set.of("trending", "completed", "ova").contains(type) ? 1 : allPages || type.equals("airing") ? 1000 : 3;
        boolean complete = false;
        try {
            for (int page = 1; page <= maxPages; page++) {
                Map<String, Object> params = new HashMap<>(Map.of("page", page));
                if (seasonal) { params.put("season", season); params.put("year", year); }
                JsonNode data = client.request(gql, params).path("Page");
                if (!data.path("media").isArray()) throw new ApiException(502, "AniList 목록 응답이 올바르지 않습니다.");
                for (JsonNode media : data.path("media")) {
                    if (type.equals("trending") && (media.path("averageScore").asInt() < 70 || media.path("popularity").asInt() < 80000)) continue;
                    if (ids.add(media.path("id").asInt())) persist(media, type);
                }
                if (!data.path("pageInfo").path("hasNextPage").asBoolean()) { complete = true; break; }
            }
            if (type.equals("genre") && allPages) {
                if (!complete) throw new ApiException(502, "전체 페이지를 수집하지 못했습니다. 카탈로그 비활성화를 건너뜁니다.");
                mongo.updateMulti(query(where("season").is(season).and("seasonYear").is(year).and("_id").nin(ids)),
                        new Update().set("isCatalogActive", false), "animes");
            }
            return ids.size();
        } finally { cache.invalidate(); }
    }
    public void persist(JsonNode media, String type) {
        int id = media.path("id").asInt();
        if (id <= 0) throw new ApiException(502, "AniList ID가 올바르지 않습니다.");
        Document old = store.find("animes", query(where("_id").is(id)));
        if (unchanged(media, old, type)) {
            Update checked = new Update().set("lastCheckedAt", new Date());
            checked.addToSet("contentTypes").each(type, "detail");
            if (type.equals("genre")) checked.set("isCatalogActive", true);
            store.update("animes", query(where("_id").is(id)), checked, false);
            return;
        }
        Document values = mapMedia(media, old, type);
        Update update = new Update(); values.forEach(update::set);
        update.setOnInsert("createdAt", new Date()).set("modifiedAt", new Date());
        update.addToSet("contentTypes").each(type, "detail");
        store.update("animes", query(where("_id").is(id)), update, true);
    }
    private boolean unchanged(JsonNode media, Document old, String type) {
        if (old == null || type.equals("detail")) return false;
        String title = Objects.toString(old.getString("title"), "");
        if (title.isBlank() || TranslationService.needsTranslation(title)) return false;
        Document image = old.get("image", Document.class);
        if (image == null || Objects.toString(image.getString("large"), "").isBlank()
                || Objects.toString(old.getString("description"), "").isBlank() || !old.containsKey("characters")) return false;
        Document localization = old.get("localization", Document.class);
        if (localization != null && localization.getString("title") != null && !localization.getString("title").isBlank()
                && !title.equals(localization.getString("title"))) return false;
        if (!Objects.equals(old.get("originalTitle"), jsonDocument(media.path("title")))) return false;
        for (String field : List.of("updatedAt", "averageScore", "popularity", "seasonYear")) {
            long stored = old.get(field) instanceof Number n ? n.longValue() : 0;
            if (stored != media.path(field).asLong()) return false;
        }
        for (String field : List.of("status", "season"))
            if (!Objects.toString(old.getString(field), "").equals(media.path(field).asText(""))) return false;
        Document next = old.get("nextAiringEpisode", Document.class);
        JsonNode airing = media.path("nextAiringEpisode");
        if (airing.isObject()) {
            return next != null && next.get("airingAt") instanceof Number at && at.longValue() == airing.path("airingAt").asLong()
                    && next.get("episode") instanceof Number episode && episode.intValue() == airing.path("episode").asInt()-1;
        }
        return next == null && Objects.equals(old.get("episodes"), nullable(media.path("episodes")));
    }
    Document mapMedia(JsonNode media, Document old, String type) {
        String sourceTitle = first(media.path("title"), "native", "romaji", "english");
        String oldTitle = old == null ? "" : Objects.toString(old.getString("title"), "");
        Document localization = old == null ? null : old.get("localization", Document.class);
        String verified = localization == null ? "" : Objects.toString(localization.getString("title"), "");
        String title = !verified.isBlank() ? verified : oldTitle.matches("(?s).*[가-힣].*") ? oldTitle : translations.translate(sourceTitle, "title");
        if (title.isBlank()) title = sourceTitle;
        JsonNode airing = media.path("nextAiringEpisode");
        boolean detail = type.equals("detail");
        int current = airing.path("episode").asInt() - 1;
        Object episodes = detail ? nullable(media.path("episodes")) : current >= 0 ? current : nullable(media.path("episodes"));
        if (detail && media.path("status").asText().equals("NOT_YET_RELEASED")) episodes = null;
        Document image = new Document("large", media.path("coverImage").path("large").asText(""))
                .append("extraLarge", media.path("coverImage").path("extraLarge").asText(""))
                .append("banner", media.path("bannerImage").asText(""));
        List<String> genres = new ArrayList<>(), studios = new ArrayList<>();
        media.path("genres").forEach(value -> genres.add(translations.genre(value.asText())));
        media.path("studios").path("nodes").forEach(value -> { if (!value.path("name").asText().isBlank()) studios.add(value.path("name").asText()); });
        if (studios.isEmpty()) studios.add("미정");
        List<Document> characters = new ArrayList<>();
        media.path("characters").path("edges").forEach(edge -> {
            JsonNode node = edge.path("node");
            characters.add(new Document("anilistId", nullable(node.path("id"))).append("role", edge.path("role").asText())
                    .append("name", new Document("full", node.path("name").path("full").asText())
                            .append("native", translations.translate(node.path("name").path("native").asText(""), "character")))
                    .append("image", new Document("large", node.path("image").path("large").asText(""))));
        });
        String cleanDescription = media.path("description").asText("").replaceAll("<[^>]*>", "").trim();
        String description = cleanDescription.isBlank() ? "줄거리 정보 없음" : translations.translate(cleanDescription, "synopsis");
        String days = "";
        if (airing.path("airingAt").isNumber()) {
            int day = Instant.ofEpochSecond(airing.path("airingAt").asLong()).atZone(ZoneId.of("Asia/Seoul")).getDayOfWeek().getValue();
            days = List.of("월", "화", "수", "목", "금", "토", "일").get(day - 1);
        }
        Document values = new Document("idMal", nullable(media.path("idMal"))).append("type", media.path("format").asText("TV"))
                .append("title", title).append("originalTitle", jsonDocument(media.path("title"))).append("image", image)
                .append("bannerImage", media.path("bannerImage").asText("")).append("genres", genres).append("studio", studios)
                .append("description", description).append("characters", characters).append("trailer", jsonDocument(media.path("trailer")))
                .append("episodes", episodes).append("status", media.path("status").asText("")).append("season", media.path("season").asText(""))
                .append("seasonYear", nullable(media.path("seasonYear"))).append("startDate", jsonDocument(media.path("startDate")))
                .append("averageScore", media.path("averageScore").asInt()).append("popularity", media.path("popularity").asInt())
                .append("days", days).append("updatedAt", nullable(media.path("updatedAt")))
                .append("lastCheckedAt", new Date()).append("lastSyncedAt", new Date());
        Document next = jsonDocument(airing);
        if (next != null && !detail) next.put("episode", current);
        values.put("nextAiringEpisode", next);
        if (type.equals("genre")) values.put("isCatalogActive", true);
        return values;
    }
    private static Document jsonDocument(JsonNode value) { return value.isObject() ? Document.parse(value.toString()) : null; }
    private static Object nullable(JsonNode node) { return node.isNumber() ? node.numberValue() : null; }
    private static String first(JsonNode node, String... names) {
        for (String name : names) if (!node.path(name).asText("").isBlank()) return node.path(name).asText(); return "";
    }
}
