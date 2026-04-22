package com.glowlogics.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String name;

  @Column(length = 2000)
  private String description;

  @Column
  private String category;

  @Column(nullable = false)
  private BigDecimal price;

  @Column(name = "discount_price")
  private BigDecimal discountPrice;

  @Column(nullable = false)
  private Integer stock;

  @Column(name = "image_url")
  private String imageUrl;

  @Column(nullable = false)
  private Double rating;

  @Column(name = "review_count", nullable = false)
  private Integer reviewCount;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  @PrePersist
  public void onCreate() {
    if (createdAt == null) {
      createdAt = LocalDateTime.now();
    }
    if (rating == null) {
      rating = 0.0;
    }
    if (reviewCount == null) {
      reviewCount = 0;
    }
    if (stock == null) {
      stock = 0;
    }
  }
}
