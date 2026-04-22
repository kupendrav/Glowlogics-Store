package com.glowlogics.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.glowlogics.entity.ProductImage;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

  List<ProductImage> findByProductIdOrderBySortOrderAsc(Long productId);

  List<ProductImage> findByProductIdInOrderByProductIdAscSortOrderAsc(List<Long> productIds);

  void deleteByProductId(Long productId);
}
