package com.glowlogics.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderDTO {

  private Long id;
  private BigDecimal totalAmount;
  private String status;
  private String shippingAddress;
  private String paymentMethod;
  private LocalDateTime createdAt;

  @Builder.Default
  private List<CartItemDTO> items = new ArrayList<>();
}
