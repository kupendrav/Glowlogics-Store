package com.glowlogics.security;

import com.glowlogics.entity.User;
import com.glowlogics.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

  private final UserRepository userRepository;

  public UserDetailsServiceImpl(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Override
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    User user = userRepository.findByEmailIgnoreCase(username)
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    List<SimpleGrantedAuthority> authorities = new ArrayList<>();
    authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
    if (user.isAdmin()) {
      authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    return org.springframework.security.core.userdetails.User.builder()
      .username(user.getEmail())
      .password(user.getPassword())
      .authorities(authorities)
      .build();
  }
}
