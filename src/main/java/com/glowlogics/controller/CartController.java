package com.glowlogics.controller;

import com.glowlogics.dto.CartItemDTO;
import com.glowlogics.entity.User;
import com.glowlogics.exception.UnauthorizedException;
import com.glowlogics.service.CartService;
import com.glowlogics.service.UserService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cart")
public class CartController {

  private final CartService cartService;
  private final UserService userService;

  public CartController(CartService cartService, UserService userService) {
    this.cartService = cartService;
    this.userService = userService;
  }

  @GetMapping
  public ResponseEntity<List<CartItemDTO>> getCart(Authentication authentication) {
    return ResponseEntity.ok(cartService.getCart(getCurrentUser(authentication)));
  }

  @PostMapping("/{productId}")
  public ResponseEntity<List<CartItemDTO>> addToCart(
    @PathVariable Long productId,
    @RequestParam(defaultValue = "1") Integer quantity,
    Authentication authentication
  ) {
    return ResponseEntity.ok(cartService.addItem(getCurrentUser(authentication), productId, quantity));
  }

  @PutMapping
  public ResponseEntity<List<CartItemDTO>> updateCart(
    @RequestBody(required = false) List<CartItemDTO> items,
    Authentication authentication
  ) {
    return ResponseEntity.ok(cartService.replaceCart(getCurrentUser(authentication), items));
  }

  @DeleteMapping("/{productId}")
  public ResponseEntity<Void> removeItem(@PathVariable Long productId, Authentication authentication) {
    cartService.removeItem(getCurrentUser(authentication), productId);
    return ResponseEntity.noContent().build();
  }

  private User getCurrentUser(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new UnauthorizedException("Authentication required");
    }
    return userService.getByEmail(authentication.getName());
  }
}
