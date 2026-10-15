package com.mednet.provider.data;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface ProviderApplicationRepository extends JpaRepository<ProviderApplicationEntity, String> {
    List<ProviderApplicationEntity> findTop100ByOrderByCreatedAtDesc();

    List<ProviderApplicationEntity> findTop100ByStatusOrderByCreatedAtDesc(String status);

    Optional<ProviderApplicationEntity> findFirstByEmailIgnoreCaseAndStatusOrderByReviewedAtDesc(
            String email, String status);

    Optional<ProviderApplicationEntity> findFirstByEmailIgnoreCaseOrderByCreatedAtDesc(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select provider from ProviderApplicationEntity provider where provider.id = :id")
    Optional<ProviderApplicationEntity> findByIdForUpdate(@Param("id") String id);

    @Query("""
            select provider from ProviderApplicationEntity provider
            where provider.status = 'APPROVED'
              and (:specialty = '' or lower(provider.specialty) like lower(concat('%', :specialty, '%')))
              and (:search = '' or lower(provider.displayName) like lower(concat('%', :search, '%'))
                   or lower(provider.specialty) like lower(concat('%', :search, '%')))
            """)
    Page<ProviderApplicationEntity> findApprovedDirectory(
            @Param("specialty") String specialty,
            @Param("search") String search,
            Pageable pageable);

    long countByStatus(String status);

    Optional<ProviderApplicationEntity> findByIdAndStatus(String id, String status);

    /** Administrator list: optional status, optional "%term%" (lower case) over name, email, specialty, credential. */
    @Query("""
            select provider from ProviderApplicationEntity provider
            where (:status = '' or provider.status = :status)
              and (:pattern = ''
                   or lower(provider.displayName) like :pattern
                   or lower(provider.email) like :pattern
                   or lower(provider.specialty) like :pattern
                   or lower(provider.credentialReference) like :pattern)
            order by provider.createdAt desc
            """)
    Page<ProviderApplicationEntity> searchApplications(
            @Param("status") String status, @Param("pattern") String pattern, Pageable pageable);

    /** Approved providers per specialty, most first (public directory facet). */
    @Query("""
            select provider.specialty as specialty, count(provider) as providers
            from ProviderApplicationEntity provider
            where provider.status = 'APPROVED'
            group by provider.specialty
            order by count(provider) desc, provider.specialty asc
            """)
    List<SpecialtyCount> countApprovedBySpecialty();

    interface SpecialtyCount {
        String getSpecialty();

        long getProviders();
    }
}
