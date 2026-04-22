package com.glowlogics.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.glowlogics.dto.UnsplashImageDTO;
import com.glowlogics.service.UnsplashImageService;

@RestController
@RequestMapping("/api/images")
public class ImageController {

  private final UnsplashImageService unsplashImageService;

  public ImageController(UnsplashImageService unsplashImageService) {
    this.unsplashImageService = unsplashImageService;
  }

  @GetMapping("/unsplash/search")
  public ResponseEntity<List<UnsplashImageDTO>> searchUnsplashImages(
    @RequestParam String query,
    @RequestParam(defaultValue = "3") int count
  ) {
    return ResponseEntity.ok(unsplashImageService.searchUnsplashImages(query, count));
  }
}
