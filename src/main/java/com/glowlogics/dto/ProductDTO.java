package com.glowlogics.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDTO {

  private Long id;
  private String name;
  private String description;
  private String category;
  private BigDecimal price;
  private BigDecimal discountPrice;
  private BigDecimal finalPrice;
  private Integer stock;
  private String imageUrl;
  private List<String> imageUrls;
  private Double rating;
  private Integer reviewCount;
  private LocalDateTime createdAt;
}
