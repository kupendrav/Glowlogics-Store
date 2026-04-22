package com.glowlogics.controller;

import com.glowlogics.dto.ApiMessage;
import com.glowlogics.dto.AuthResponse;
import com.glowlogics.dto.LoginRequest;
import com.glowlogics.dto.UserDTO;
import com.glowlogics.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/login")
  public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
    return ResponseEntity.ok(authService.login(request.getEmail(), request.getPassword()));
  }

  @PostMapping("/signup")
  public ResponseEntity<AuthResponse> signup(@Valid @RequestBody UserDTO userDTO) {
    return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(userDTO));
  }

  @PostMapping("/logout")
  public ResponseEntity<ApiMessage> logout() {
    return ResponseEntity.ok(new ApiMessage("Logged out successfully"));
  }
}
