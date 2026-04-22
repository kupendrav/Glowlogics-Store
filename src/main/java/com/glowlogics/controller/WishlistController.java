package com.glowlogics.controller;

import com.glowlogics.dto.ProductDTO;
import com.glowlogics.entity.User;
import com.glowlogics.exception.UnauthorizedException;
import com.glowlogics.service.UserService;
import com.glowlogics.service.WishlistService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/wishlist")
public class WishlistController {

  private final WishlistService wishlistService;
  private final UserService userService;

  public WishlistController(WishlistService wishlistService, UserService userService) {
    this.wishlistService = wishlistService;
    this.userService = userService;
  }

  @GetMapping
  public ResponseEntity<List<ProductDTO>> getWishlist(Authentication authentication) {
    return ResponseEntity.ok(wishlistService.getWishlist(getCurrentUser(authentication)));
  }

  @PostMapping("/{productId}")
  public ResponseEntity<List<ProductDTO>> addToWishlist(@PathVariable Long productId, Authentication authentication) {
    return ResponseEntity.ok(wishlistService.add(getCurrentUser(authentication), productId));
  }

  @DeleteMapping("/{productId}")
  public ResponseEntity<List<ProductDTO>> removeFromWishlist(@PathVariable Long productId, Authentication authentication) {
    return ResponseEntity.ok(wishlistService.remove(getCurrentUser(authentication), productId));
  }

  private User getCurrentUser(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new UnauthorizedException("Authentication required");
    }
    return userService.getByEmail(authentication.getName());
  }
}
