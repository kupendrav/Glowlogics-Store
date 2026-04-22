package com.glowlogics.dto;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItemDTO {

  private Long productId;
  private String name;
  private String category;
  private String imageUrl;
  private BigDecimal price;
  private Integer quantity;
  private BigDecimal subtotal;
}
