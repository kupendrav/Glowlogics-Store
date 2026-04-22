package com.glowlogics.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.glowlogics.dto.ProductDTO;
import com.glowlogics.entity.Product;
import com.glowlogics.entity.ProductImage;
import com.glowlogics.exception.ResourceNotFoundException;
import com.glowlogics.repository.ProductImageRepository;
import com.glowlogics.repository.ProductRepository;

@Service
public class ProductService {

  private static final int MAX_IMAGE_URLS = 3;

  private final ProductRepository productRepository;
  private final ProductImageRepository productImageRepository;

  public ProductService(ProductRepository productRepository, ProductImageRepository productImageRepository) {
    this.productRepository = productRepository;
    this.productImageRepository = productImageRepository;
  }

  @Transactional(readOnly = true)
  public Page<ProductDTO> getProducts(
    int page,
    int size,
    String category,
    BigDecimal minPrice,
    BigDecimal maxPrice,
    String search,
    String sort
  ) {
    List<Product> products = new ArrayList<>(productRepository.findAll());

    if (category != null && !category.isBlank()) {
      String categoryFilter = category.trim().toLowerCase(Locale.ROOT);
      products = products.stream()
        .filter(product -> product.getCategory() != null && product.getCategory().toLowerCase(Locale.ROOT).contains(categoryFilter))
        .toList();
    }

    if (search != null && !search.isBlank()) {
      String searchFilter = search.trim().toLowerCase(Locale.ROOT);
      products = products.stream()
        .filter(product -> {
          String name = product.getName() == null ? "" : product.getName().toLowerCase(Locale.ROOT);
          String description = product.getDescription() == null ? "" : product.getDescription().toLowerCase(Locale.ROOT);
          String categoryText = product.getCategory() == null ? "" : product.getCategory().toLowerCase(Locale.ROOT);
          return name.contains(searchFilter) || description.contains(searchFilter) || categoryText.contains(searchFilter);
        })
        .toList();
    }

    if (minPrice != null) {
      products = products.stream().filter(product -> finalPrice(product).compareTo(minPrice) >= 0).toList();
    }

    if (maxPrice != null) {
      products = products.stream().filter(product -> finalPrice(product).compareTo(maxPrice) <= 0).toList();
    }

    if (sort != null) {
      switch (sort) {
        case "priceAsc" -> products = products.stream().sorted(Comparator.comparing(this::finalPrice)).toList();
        case "priceDesc" -> products = products.stream().sorted(Comparator.comparing(this::finalPrice).reversed()).toList();
        case "topRated" -> products = products.stream().sorted(Comparator.comparing(Product::getRating).reversed()).toList();
        default -> products = products.stream().sorted(Comparator.comparing(Product::getCreatedAt).reversed()).toList();
      }
    } else {
      products = products.stream().sorted(Comparator.comparing(Product::getCreatedAt).reversed()).toList();
    }

    Pageable pageable = PageRequest.of(page, size);
    int start = Math.min((int) pageable.getOffset(), products.size());
    int end = Math.min(start + pageable.getPageSize(), products.size());
    List<Product> pageProducts = products.subList(start, end);
    Map<Long, List<String>> imageUrlMap = loadImageUrlsByProductIds(pageProducts);
    List<ProductDTO> content = pageProducts.stream()
      .map(product -> toDTO(product, imageUrlMap.get(product.getId())))
      .toList();

    return new PageImpl<>(content, pageable, products.size());
  }

  @Transactional(readOnly = true)
  public ProductDTO getProductById(Long id) {
    Product product = productRepository.findById(id)
      .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
    return toDTO(product, loadImageUrlsByProductIds(List.of(product)).get(product.getId()));
  }

  @Transactional(readOnly = true)
  public List<ProductDTO> searchProducts(String query) {
    List<Product> products = productRepository.findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(query, query);
    Map<Long, List<String>> imageUrlMap = loadImageUrlsByProductIds(products);
    return products.stream().map(product -> toDTO(product, imageUrlMap.get(product.getId()))).toList();
  }

  @Transactional(readOnly = true)
  public List<ProductDTO> getAllProducts() {
    List<Product> products = productRepository.findAll();
    Map<Long, List<String>> imageUrlMap = loadImageUrlsByProductIds(products);
    return products.stream().map(product -> toDTO(product, imageUrlMap.get(product.getId()))).toList();
  }

  @Transactional
  public ProductDTO saveProduct(ProductDTO request) {
    Product product = request.getId() == null
      ? new Product()
      : productRepository.findById(request.getId())
      .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

    boolean hasSingleImage = request.getImageUrl() != null && !request.getImageUrl().isBlank();
    boolean hasImageList = request.getImageUrls() != null;
    List<String> requestedImageUrls = hasImageList || hasSingleImage
      ? normalizeImageUrls(request.getImageUrls(), request.getImageUrl())
      : null;

    product.setName(request.getName());
    product.setDescription(request.getDescription());
    product.setCategory(request.getCategory());
    product.setPrice(request.getPrice());
    product.setDiscountPrice(request.getDiscountPrice());
    product.setStock(request.getStock());
    if (requestedImageUrls != null && !requestedImageUrls.isEmpty()) {
      product.setImageUrl(requestedImageUrls.get(0));
    } else if (hasSingleImage) {
      product.setImageUrl(request.getImageUrl().trim());
    }
    Double rating = request.getRating();
    Integer reviewCount = request.getReviewCount();
    product.setRating(rating != null ? rating : 4.3);
    product.setReviewCount(reviewCount != null ? reviewCount : 0);

    Product savedProduct = productRepository.save(product);

    if (requestedImageUrls != null) {
      productImageRepository.deleteByProductId(savedProduct.getId());
      for (int index = 0; index < requestedImageUrls.size(); index++) {
        productImageRepository.save(ProductImage.builder()
          .productId(savedProduct.getId())
          .imageUrl(requestedImageUrls.get(index))
          .sortOrder(index + 1)
          .build());
      }
      return toDTO(savedProduct, requestedImageUrls);
    }

    return toDTO(savedProduct, loadImageUrlsByProductIds(List.of(savedProduct)).get(savedProduct.getId()));
  }

  @Transactional
  public void deleteProduct(Long id) {
    if (!productRepository.existsById(id)) {
      throw new ResourceNotFoundException("Product not found");
    }
    productRepository.deleteById(id);
  }

  public ProductDTO toDTO(Product product) {
    return toDTO(product, loadImageUrlsByProductIds(List.of(product)).get(product.getId()));
  }

  private ProductDTO toDTO(Product product, List<String> imageUrls) {
    List<String> normalizedImageUrls = normalizeImageUrls(imageUrls, product.getImageUrl());
    return ProductDTO.builder()
      .id(product.getId())
      .name(product.getName())
      .description(product.getDescription())
      .category(product.getCategory())
      .price(product.getPrice())
      .discountPrice(product.getDiscountPrice())
      .finalPrice(finalPrice(product))
      .stock(product.getStock())
      .imageUrl(normalizedImageUrls.isEmpty() ? null : normalizedImageUrls.get(0))
      .imageUrls(normalizedImageUrls)
      .rating(product.getRating())
      .reviewCount(product.getReviewCount())
      .createdAt(product.getCreatedAt())
      .build();
  }

  private Map<Long, List<String>> loadImageUrlsByProductIds(List<Product> products) {
    Map<Long, List<String>> imageUrlMap = new HashMap<>();
    if (products == null || products.isEmpty()) {
      return imageUrlMap;
    }

    List<Long> productIds = products.stream()
      .map(Product::getId)
      .filter(id -> id != null)
      .toList();

    if (!productIds.isEmpty()) {
      for (ProductImage productImage : productImageRepository.findByProductIdInOrderByProductIdAscSortOrderAsc(productIds)) {
        if (productImage.getImageUrl() == null || productImage.getImageUrl().isBlank()) {
          continue;
        }
        imageUrlMap.computeIfAbsent(productImage.getProductId(), key -> new ArrayList<>())
          .add(productImage.getImageUrl().trim());
      }
    }

    for (Product product : products) {
      if (product.getId() == null || imageUrlMap.containsKey(product.getId())) {
        continue;
      }
      if (product.getImageUrl() != null && !product.getImageUrl().isBlank()) {
        imageUrlMap.put(product.getId(), List.of(product.getImageUrl().trim()));
      }
    }

    return imageUrlMap;
  }

  private List<String> normalizeImageUrls(List<String> imageUrls, String fallbackImageUrl) {
    Set<String> normalized = new LinkedHashSet<>();
    if (imageUrls != null) {
      for (String imageUrl : imageUrls) {
        if (imageUrl != null && !imageUrl.isBlank()) {
          normalized.add(imageUrl.trim());
        }
      }
    }

    if (normalized.isEmpty() && fallbackImageUrl != null && !fallbackImageUrl.isBlank()) {
      normalized.add(fallbackImageUrl.trim());
    }

    return normalized.stream().limit(MAX_IMAGE_URLS).toList();
  }

  private BigDecimal finalPrice(Product product) {
    return product.getDiscountPrice() != null ? product.getDiscountPrice() : product.getPrice();
  }
}
