package com.glowlogics.repository;

import com.glowlogics.entity.CustomerOrder;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<CustomerOrder, Long> {

  List<CustomerOrder> findByUserIdOrderByCreatedAtDesc(Long userId);
}
