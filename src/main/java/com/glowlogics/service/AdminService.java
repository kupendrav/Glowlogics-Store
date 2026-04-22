package com.glowlogics.service;

import com.glowlogics.dto.OrderDTO;
import com.glowlogics.dto.ProductDTO;
import com.glowlogics.dto.UserDTO;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AdminService {

  private final ProductService productService;
  private final OrderService orderService;
  private final UserService userService;

  public AdminService(ProductService productService, OrderService orderService, UserService userService) {
    this.productService = productService;
    this.orderService = orderService;
    this.userService = userService;
  }

  public List<ProductDTO> getProducts() {
    return productService.getAllProducts();
  }

  public ProductDTO saveProduct(ProductDTO productDTO) {
    return productService.saveProduct(productDTO);
  }

  public void deleteProduct(Long id) {
    productService.deleteProduct(id);
  }

  public List<OrderDTO> getOrders() {
    return orderService.getAllOrders();
  }

  public List<UserDTO> getUsers() {
    return userService.getAllUsers();
  }
}
