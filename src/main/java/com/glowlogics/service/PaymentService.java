package com.glowlogics.service;

import com.glowlogics.dto.PaymentRequest;
import com.glowlogics.dto.PaymentResponse;
import com.glowlogics.entity.CustomerOrder;
import com.glowlogics.entity.Payment;
import com.glowlogics.entity.PaymentStatus;
import com.glowlogics.repository.OrderRepository;
import com.glowlogics.repository.PaymentRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentService {

  private final PaymentRepository paymentRepository;
  private final OrderRepository orderRepository;

  public PaymentService(PaymentRepository paymentRepository, OrderRepository orderRepository) {
    this.paymentRepository = paymentRepository;
    this.orderRepository = orderRepository;
  }

  @Transactional
  public PaymentResponse processPayment(PaymentRequest request) {
    boolean success = request.getAmount() != null
      && request.getAmount().doubleValue() > 0
      && (request.getCardNumber() == null || !request.getCardNumber().replaceAll("\\s+", "").endsWith("0000"));

    CustomerOrder order = null;
    if (request.getOrderId() != null) {
      order = orderRepository.findById(request.getOrderId()).orElse(null);
    }

    Payment payment = Payment.builder()
      .order(order)
      .paymentMethod(request.getPaymentMethod() == null ? "CARD" : request.getPaymentMethod())
      .amount(request.getAmount())
      .status(success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED)
      .providerRef(UUID.randomUUID().toString().replace("-", ""))
      .build();

    Payment saved = paymentRepository.save(payment);

    return PaymentResponse.builder()
      .paymentId("PAY-" + saved.getProviderRef().substring(0, 10).toUpperCase())
      .status(saved.getStatus().name())
      .message(success ? "Payment processed successfully" : "Payment declined")
      .amount(saved.getAmount())
      .build();
  }
}
