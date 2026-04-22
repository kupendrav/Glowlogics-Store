package com.glowlogics.service;

import com.glowlogics.dto.CartItemDTO;
import com.glowlogics.entity.CartItem;
import com.glowlogics.entity.Product;
import com.glowlogics.entity.User;
import com.glowlogics.exception.ResourceNotFoundException;
import com.glowlogics.repository.CartItemRepository;
import com.glowlogics.repository.ProductRepository;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CartService {

  private final CartItemRepository cartItemRepository;
  private final ProductRepository productRepository;

  public CartService(CartItemRepository cartItemRepository, ProductRepository productRepository) {
    this.cartItemRepository = cartItemRepository;
    this.productRepository = productRepository;
  }

  @Transactional(readOnly = true)
  public List<CartItemDTO> getCart(User user) {
    return cartItemRepository.findByUserId(user.getId()).stream().map(this::toDTO).toList();
  }

  @Transactional
  public List<CartItemDTO> addItem(User user, Long productId, Integer quantity) {
    Product product = productRepository.findById(productId)
      .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

    CartItem item = cartItemRepository.findByUserIdAndProductId(user.getId(), productId)
      .orElse(CartItem.builder().user(user).product(product).quantity(0).build());

    item.setQuantity(Math.max(1, item.getQuantity() + Math.max(1, quantity == null ? 1 : quantity)));
    cartItemRepository.save(item);

    return getCart(user);
  }

  @Transactional
  public List<CartItemDTO> replaceCart(User user, List<CartItemDTO> items) {
    cartItemRepository.deleteByUserId(user.getId());

    if (items != null) {
      for (CartItemDTO itemDTO : items) {
        if (itemDTO.getQuantity() == null || itemDTO.getQuantity() < 1) {
          continue;
        }
        Product product = productRepository.findById(itemDTO.getProductId())
          .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        cartItemRepository.save(CartItem.builder()
          .user(user)
          .product(product)
          .quantity(itemDTO.getQuantity())
          .build());
      }
    }

    return getCart(user);
  }

  @Transactional
  public void removeItem(User user, Long productId) {
    cartItemRepository.findByUserIdAndProductId(user.getId(), productId)
      .ifPresent(cartItemRepository::delete);
  }

  @Transactional
  public void clearCart(User user) {
    cartItemRepository.deleteByUserId(user.getId());
  }

  public CartItemDTO toDTO(CartItem item) {
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
