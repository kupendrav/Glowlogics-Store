package com.glowlogics.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.glowlogics.dto.UnsplashImageDTO;

@Service
public class UnsplashImageService {

  private static final Logger logger = LoggerFactory.getLogger(UnsplashImageService.class);

  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;
  private final Map<String, List<UnsplashImageDTO>> queryCache = new ConcurrentHashMap<>();

  @Value("${app.unsplash.api-url:https://api.unsplash.com}")
  private String unsplashApiUrl;

  @Value("${app.unsplash.access-key:}")
  private String accessKey;

  public UnsplashImageService(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  }

  public List<UnsplashImageDTO> searchUnsplashImages(String query, int count) {
    String normalizedQuery = query == null ? "" : query.trim();
    int limit = Math.min(Math.max(count, 1), 10);

    if (normalizedQuery.isBlank()) {
      return List.of();
    }

    if (accessKey == null || accessKey.isBlank()) {
      logger.debug("Unsplash access key is not configured. Returning empty search results.");
      return List.of();
    }

    String cacheKey = normalizedQuery.toLowerCase(Locale.ROOT) + "::" + limit;
    List<UnsplashImageDTO> cached = queryCache.get(cacheKey);
    if (cached != null) {
      return cached;
    }

    try {
      List<UnsplashImageDTO> images = executeSearch(normalizedQuery, limit);
      queryCache.put(cacheKey, images);
      return images;
    } catch (IOException | InterruptedException ex) {
      if (ex instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      logger.warn("Unsplash search failed for query '{}'", normalizedQuery, ex);
      return List.of();
    }
  }

  private List<UnsplashImageDTO> executeSearch(String query, int limit) throws IOException, InterruptedException {
    int perPage = Math.min(Math.max(limit * 2, limit), 30);
    String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
    URI endpoint = URI.create(unsplashApiUrl + "/search/photos?query=" + encodedQuery + "&per_page=" + perPage);

    HttpRequest request = HttpRequest.newBuilder()
      .uri(endpoint)
      .timeout(Duration.ofSeconds(8))
      .header("Accept", "application/json")
      .header("Accept-Version", "v1")
      .header("Authorization", "Client-ID " + accessKey)
      .GET()
      .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      logger.warn("Unsplash request returned HTTP {} for query '{}'", response.statusCode(), query);
      return List.of();
    }

    JsonNode root = objectMapper.readTree(response.body());
    JsonNode results = root.path("results");

    List<UnsplashImageDTO> images = new ArrayList<>();
    Set<String> seenIds = new HashSet<>();
    for (JsonNode node : results) {
      String id = node.path("id").asText("");
      if (id.isBlank() || !seenIds.add(id)) {
        continue;
      }
      images.add(toDTO(node));
      if (images.size() >= limit) {
        break;
      }
    }

    return List.copyOf(images);
  }

  private UnsplashImageDTO toDTO(JsonNode node) {
    return UnsplashImageDTO.builder()
      .id(node.path("id").asText(""))
      .smallUrl(node.path("urls").path("small").asText(""))
      .regularUrl(node.path("urls").path("regular").asText(""))
      .fullUrl(node.path("urls").path("full").asText(""))
      .thumbUrl(node.path("urls").path("thumb").asText(""))
      .photographerName(node.path("user").path("name").asText(""))
      .photographerUsername(node.path("user").path("username").asText(""))
      .photographerProfileUrl(node.path("user").path("links").path("html").asText(""))
      .photoPageUrl(node.path("links").path("html").asText(""))
      .downloadLocation(node.path("links").path("download_location").asText(""))
      .build();
  }
}
