package com.glowlogics.dto;

import java.math.BigDecimal;
import lombok.Data;

@Data
public class PaymentRequest {

  private Long orderId;
  private BigDecimal amount;
  private String currency;
  private String paymentMethod;
  private String cardToken;
  private String cardNumber;
  private String billingDetails;
}
