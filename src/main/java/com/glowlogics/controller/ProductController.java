package com.glowlogics.controller;

import com.glowlogics.dto.ProductDTO;
import com.glowlogics.service.ProductService;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController {

  private final ProductService productService;

  public ProductController(ProductService productService) {
    this.productService = productService;
  }

  @GetMapping
  public ResponseEntity<Page<ProductDTO>> getAllProducts(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "12") int size,
    @RequestParam(required = false) String category,
    @RequestParam(required = false) BigDecimal minPrice,
    @RequestParam(required = false) BigDecimal maxPrice,
    @RequestParam(required = false) String search,
    @RequestParam(required = false) String sort
  ) {
    return ResponseEntity.ok(productService.getProducts(page, size, category, minPrice, maxPrice, search, sort));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ProductDTO> getProductById(@PathVariable Long id) {
    return ResponseEntity.ok(productService.getProductById(id));
  }

  @GetMapping("/search")
  public ResponseEntity<List<ProductDTO>> searchProducts(@RequestParam String query) {
    return ResponseEntity.ok(productService.searchProducts(query));
  }
}
