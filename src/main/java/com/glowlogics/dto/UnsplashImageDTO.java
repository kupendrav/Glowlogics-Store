package com.glowlogics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnsplashImageDTO {

  private String id;
  private String smallUrl;
  private String regularUrl;
  private String fullUrl;
  private String thumbUrl;
  private String photographerName;
  private String photographerUsername;
  private String photographerProfileUrl;
  private String photoPageUrl;
  private String downloadLocation;
}
