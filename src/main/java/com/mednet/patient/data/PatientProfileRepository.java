package com.mednet.patient.data;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientProfileRepository extends JpaRepository<PatientProfileEntity, String> {
    Optional<PatientProfileEntity> findFirstByAccountId(String accountId);

    boolean existsByAccountId(String accountId);

    java.util.List<PatientProfileEntity> findByAccountIdIn(java.util.Collection<String> accountIds);
}
