package com.glowlogics.service;

import com.glowlogics.dto.CartItemDTO;
import com.glowlogics.dto.OrderDTO;
import com.glowlogics.entity.CartItem;
import com.glowlogics.entity.CustomerOrder;
import com.glowlogics.entity.OrderItem;
import com.glowlogics.entity.OrderStatus;
import com.glowlogics.entity.Product;
import com.glowlogics.entity.User;
import com.glowlogics.exception.ResourceNotFoundException;
import com.glowlogics.repository.CartItemRepository;
import com.glowlogics.repository.OrderRepository;
import com.glowlogics.repository.ProductRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

  private final OrderRepository orderRepository;
  private final ProductRepository productRepository;
  private final CartItemRepository cartItemRepository;

  public OrderService(
    OrderRepository orderRepository,
    ProductRepository productRepository,
    CartItemRepository cartItemRepository
  ) {
    this.orderRepository = orderRepository;
    this.productRepository = productRepository;
    this.cartItemRepository = cartItemRepository;
  }

  @Transactional
  public OrderDTO createOrder(User user, OrderDTO request) {
    List<CartItemDTO> items = request.getItems() == null || request.getItems().isEmpty()
      ? cartItemRepository.findByUserId(user.getId()).stream().map(this::toDTOFromCartItem).toList()
      : request.getItems();

    if (items.isEmpty()) {
      throw new IllegalArgumentException("Cart is empty");
    }

    CustomerOrder order = CustomerOrder.builder()
      .user(user)
      .status(OrderStatus.PENDING)
      .shippingAddress(request.getShippingAddress())
      .items(new ArrayList<>())
      .build();

    BigDecimal total = BigDecimal.ZERO;

    for (CartItemDTO item : items) {
      Product product = productRepository.findById(item.getProductId())
        .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

      BigDecimal unitPrice = product.getDiscountPrice() != null ? product.getDiscountPrice() : product.getPrice();
      BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(item.getQuantity()));
      total = total.add(subtotal);

      order.getItems().add(OrderItem.builder()
        .order(order)
        .product(product)
        .quantity(item.getQuantity())
        .unitPrice(unitPrice)
        .subtotal(subtotal)
        .build());
    }

    order.setTotalAmount(total);

    CustomerOrder saved = orderRepository.save(order);
    cartItemRepository.deleteByUserId(user.getId());

    return toDTO(saved);
  }

  @Transactional(readOnly = true)
  public List<OrderDTO> getUserOrders(Long userId) {
    return orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toDTO).toList();
  }

  @Transactional(readOnly = true)
  public OrderDTO getOrderById(Long id) {
    CustomerOrder order = orderRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    return toDTO(order);
  }

  @Transactional(readOnly = true)
  public List<OrderDTO> getAllOrders() {
    return orderRepository.findAll().stream().map(this::toDTO).toList();
  }

  private OrderDTO toDTO(CustomerOrder order) {
    return OrderDTO.builder()
      .id(order.getId())
      .status(order.getStatus().name())
      .totalAmount(order.getTotalAmount())
      .shippingAddress(order.getShippingAddress())
      .createdAt(order.getCreatedAt())
      .items(order.getItems().stream().map(this::toCartItemDTO).toList())
      .build();
  }

  private CartItemDTO toCartItemDTO(OrderItem item) {
    return CartItemDTO.builder()
      .productId(item.getProduct().getId())
      .name(item.getProduct().getName())
      .category(item.getProduct().getCategory())
      .imageUrl(item.getProduct().getImageUrl())
      .price(item.getUnitPrice())
      .quantity(item.getQuantity())
      .subtotal(item.getSubtotal())
      .build();
  }

  private CartItemDTO toDTOFromCartItem(CartItem item) {
    BigDecimal unitPrice = item.getProduct().getDiscountPrice() != null
      ? item.getProduct().getDiscountPrice()
      : item.getProduct().getPrice();

    return CartItemDTO.builder()
      .productId(item.getProduct().getId())
      .name(item.getProduct().getName())
      .category(item.getProduct().getCategory())
      .imageUrl(item.getProduct().getImageUrl())
      .price(unitPrice)
      .quantity(item.getQuantity())
      .subtotal(unitPrice.multiply(BigDecimal.valueOf(item.getQuantity())))
      .build();
  }
}
