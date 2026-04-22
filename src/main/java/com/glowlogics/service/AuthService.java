package com.glowlogics.service;

import com.glowlogics.dto.AuthResponse;
import com.glowlogics.dto.UserDTO;
import com.glowlogics.entity.User;
import com.glowlogics.exception.UnauthorizedException;
import com.glowlogics.repository.UserRepository;
import com.glowlogics.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final UserRepository userRepository;
  private final UserService userService;
  private final PasswordEncoder passwordEncoder;
  private final JwtTokenProvider jwtTokenProvider;

  public AuthService(
    UserRepository userRepository,
    UserService userService,
    PasswordEncoder passwordEncoder,
    JwtTokenProvider jwtTokenProvider
  ) {
    this.userRepository = userRepository;
    this.userService = userService;
    this.passwordEncoder = passwordEncoder;
    this.jwtTokenProvider = jwtTokenProvider;
  }

  @Transactional
  public AuthResponse signup(UserDTO request) {
    if (userRepository.existsByEmailIgnoreCase(request.getEmail())) {
      throw new IllegalArgumentException("Email already exists");
    }

    User user = User.builder()
      .email(request.getEmail().trim().toLowerCase())
      .password(passwordEncoder.encode(request.getPassword()))
      .fullName(request.getFullName().trim())
      .phone(request.getPhone())
      .admin(false)
      .build();

    userRepository.save(user);
    String token = jwtTokenProvider.generateToken(user);

    return AuthResponse.builder()
      .token(token)
      .user(userService.toDTO(user))
      .build();
  }

  @Transactional
  public AuthResponse login(String email, String password) {
    User user = userRepository.findByEmailIgnoreCase(email)
      .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

    if (!passwordMatches(password, user.getPassword())) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!isBcrypt(user.getPassword())) {
      user.setPassword(passwordEncoder.encode(password));
      userRepository.save(user);
    }

    String token = jwtTokenProvider.generateToken(user);
    return AuthResponse.builder()
      .token(token)
      .user(userService.toDTO(user))
      .build();
  }

  private boolean passwordMatches(String rawPassword, String storedPassword) {
    if (isBcrypt(storedPassword)) {
      return passwordEncoder.matches(rawPassword, storedPassword);
    }
    return rawPassword.equals(storedPassword);
  }

  private boolean isBcrypt(String password) {
    return password != null && (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$"));
  }
}
