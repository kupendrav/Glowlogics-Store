package com.glowlogics.service;

import com.glowlogics.dto.ProductDTO;
import com.glowlogics.entity.Product;
import com.glowlogics.entity.User;
import com.glowlogics.entity.WishlistItem;
import com.glowlogics.exception.ResourceNotFoundException;
import com.glowlogics.repository.ProductRepository;
import com.glowlogics.repository.WishlistRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WishlistService {

  private final WishlistRepository wishlistRepository;
  private final ProductRepository productRepository;
  private final ProductService productService;

  public WishlistService(
    WishlistRepository wishlistRepository,
    ProductRepository productRepository,
    ProductService productService
  ) {
    this.wishlistRepository = wishlistRepository;
    this.productRepository = productRepository;
    this.productService = productService;
  }

  @Transactional(readOnly = true)
  public List<ProductDTO> getWishlist(User user) {
    return wishlistRepository.findByUserId(user.getId())
      .stream()
      .map(WishlistItem::getProduct)
      .map(productService::toDTO)
      .toList();
  }

  @Transactional
  public List<ProductDTO> add(User user, Long productId) {
    Product product = productRepository.findById(productId)
      .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

    wishlistRepository.findByUserIdAndProductId(user.getId(), productId)
      .orElseGet(() -> wishlistRepository.save(WishlistItem.builder()
        .user(user)
        .product(product)
        .build()));

    return getWishlist(user);
  }

  @Transactional
  public List<ProductDTO> remove(User user, Long productId) {
    wishlistRepository.deleteByUserIdAndProductId(user.getId(), productId);
    return getWishlist(user);
  }
}
