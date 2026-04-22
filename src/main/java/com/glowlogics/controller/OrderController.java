package com.glowlogics.controller;

import com.glowlogics.dto.OrderDTO;
import com.glowlogics.entity.User;
import com.glowlogics.exception.UnauthorizedException;
import com.glowlogics.service.OrderService;
import com.glowlogics.service.UserService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

  private final OrderService orderService;
  private final UserService userService;

  public OrderController(OrderService orderService, UserService userService) {
    this.orderService = orderService;
    this.userService = userService;
  }

  @PostMapping
  public ResponseEntity<OrderDTO> createOrder(@RequestBody(required = false) OrderDTO request, Authentication authentication) {
    OrderDTO payload = request == null ? OrderDTO.builder().build() : request;
    return ResponseEntity.status(HttpStatus.CREATED).body(orderService.createOrder(getCurrentUser(authentication), payload));
  }

  @GetMapping
  public ResponseEntity<List<OrderDTO>> getUserOrders(Authentication authentication) {
    return ResponseEntity.ok(orderService.getUserOrders(getCurrentUser(authentication).getId()));
  }

  @GetMapping("/{id}")
  public ResponseEntity<OrderDTO> getOrderById(@PathVariable Long id) {
    return ResponseEntity.ok(orderService.getOrderById(id));
  }

  private User getCurrentUser(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new UnauthorizedException("Authentication required");
    }
    return userService.getByEmail(authentication.getName());
  }
}
