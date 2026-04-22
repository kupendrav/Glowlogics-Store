package com.glowlogics.repository;

import com.glowlogics.entity.WishlistItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WishlistRepository extends JpaRepository<WishlistItem, Long> {

  List<WishlistItem> findByUserId(Long userId);

  Optional<WishlistItem> findByUserIdAndProductId(Long userId, Long productId);

  void deleteByUserIdAndProductId(Long userId, Long productId);
}
