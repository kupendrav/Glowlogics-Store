package com.glowlogics.service;

import com.glowlogics.dto.UserDTO;
import com.glowlogics.entity.User;
import com.glowlogics.exception.ResourceNotFoundException;
import com.glowlogics.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

  private final UserRepository userRepository;

  public UserService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public User getByEmail(String email) {
    return userRepository.findByEmailIgnoreCase(email)
      .orElseThrow(() -> new ResourceNotFoundException("User not found"));
  }

  @Transactional(readOnly = true)
  public UserDTO getProfile(String email) {
    return toDTO(getByEmail(email));
  }

  @Transactional
  public UserDTO updateProfile(String email, UserDTO request) {
    User user = getByEmail(email);
    user.setFullName(request.getFullName());
    user.setPhone(request.getPhone());

    if (!email.equalsIgnoreCase(request.getEmail())) {
      if (userRepository.existsByEmailIgnoreCase(request.getEmail())) {
        throw new IllegalArgumentException("Email is already in use");
      }
      user.setEmail(request.getEmail());
    }

    userRepository.save(user);
    return toDTO(user);
  }

  @Transactional(readOnly = true)
  public List<UserDTO> getAllUsers() {
    return userRepository.findAll().stream().map(this::toDTO).toList();
  }

  public UserDTO toDTO(User user) {
    return UserDTO.builder()
      .id(user.getId())
      .email(user.getEmail())
      .fullName(user.getFullName())
      .phone(user.getPhone())
      .admin(user.isAdmin())
      .build();
  }
}
