package com.glowlogics.controller;

import com.glowlogics.dto.ProductDTO;
import com.glowlogics.dto.OrderDTO;
import com.glowlogics.dto.UserDTO;
import com.glowlogics.service.AdminService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

  private final AdminService adminService;

  public AdminController(AdminService adminService) {
    this.adminService = adminService;
  }

  @GetMapping("/products")
  public ResponseEntity<List<ProductDTO>> products() {
    return ResponseEntity.ok(adminService.getProducts());
  }

  @PostMapping("/products")
  public ResponseEntity<ProductDTO> saveProduct(@RequestBody ProductDTO productDTO) {
    return ResponseEntity.ok(adminService.saveProduct(productDTO));
  }

  @DeleteMapping("/products/{id}")
  public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
    adminService.deleteProduct(id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/orders")
  public ResponseEntity<List<OrderDTO>> orders() {
    return ResponseEntity.ok(adminService.getOrders());
  }

  @GetMapping("/users")
  public ResponseEntity<List<UserDTO>> users() {
    return ResponseEntity.ok(adminService.getUsers());
  }
}
