package com.glowlogics.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {

  private Long id;

  @NotBlank
  private String fullName;

  @Email
  @NotBlank
  private String email;

  private String phone;

  private String password;
  private boolean admin;
}
