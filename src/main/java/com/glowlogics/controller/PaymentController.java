package com.glowlogics.controller;

import com.glowlogics.dto.PaymentRequest;
import com.glowlogics.dto.PaymentResponse;
import com.glowlogics.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payment")
public class PaymentController {

  private final PaymentService paymentService;

  public PaymentController(PaymentService paymentService) {
    this.paymentService = paymentService;
  }

  @PostMapping("/process")
  public ResponseEntity<PaymentResponse> processPayment(@RequestBody PaymentRequest request) {
    return ResponseEntity.ok(paymentService.processPayment(request));
  }
}
