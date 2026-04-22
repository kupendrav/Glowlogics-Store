package com.glowlogics.controller;

import com.glowlogics.dto.UserDTO;
import com.glowlogics.exception.UnauthorizedException;
import com.glowlogics.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @GetMapping("/me")
  public ResponseEntity<UserDTO> me(Authentication authentication) {
    return ResponseEntity.ok(userService.getProfile(currentEmail(authentication)));
  }

  @PutMapping("/me")
  public ResponseEntity<UserDTO> updateMe(@RequestBody UserDTO request, Authentication authentication) {
    return ResponseEntity.ok(userService.updateProfile(currentEmail(authentication), request));
  }

  private String currentEmail(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      throw new UnauthorizedException("Authentication required");
    }
    return authentication.getName();
  }
}
