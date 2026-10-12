package com.mednet.laboratory.data;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface LaboratoryResultRepository extends JpaRepository<LaboratoryResultEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select result from LaboratoryResultEntity result where result.id = :id")
    Optional<LaboratoryResultEntity> findByIdForUpdate(@Param("id") String id);

    List<LaboratoryResultEntity> findTop100ByPatientAccountIdAndStatusOrderByCreatedAtDesc(
            String patientAccountId, String status);

    List<LaboratoryResultEntity> findTop100ByPatientAccountIdAndStatusOrderByCreatedAtAsc(
            String patientAccountId, String status);

    Optional<LaboratoryResultEntity> findByIdAndPatientAccountIdAndStatus(
            String id, String patientAccountId, String status);

    boolean existsByRequestIdAndStatus(String requestId, String status);

    List<LaboratoryResultEntity> findTop100ByAuthorAccountIdOrderByCreatedAtDesc(String authorAccountId);

    Page<LaboratoryResultEntity> findByPatientAccountIdAndStatusOrderByCreatedAtDesc(
            String patientAccountId, String status, Pageable pageable);

    /** A laboratory's own submissions on requests still assigned to it, optionally one status. */
    @Query("""
            select result from LaboratoryResultEntity result
            where result.authorAccountId = :authorId
              and (:status = '' or result.status = :status)
              and exists (
                  select request.id from PatientServiceRequestEntity request
                  where request.id = result.requestId
                    and request.assignedStaffAccountId = :authorId
                    and request.requestType = 'LABORATORY')
            order by result.createdAt desc
            """)
    Page<LaboratoryResultEntity> findPartnerResults(
            @Param("authorId") String authorId, @Param("status") String status, Pageable pageable);

    /** Every result on the given requests, newest first (to find each request's latest). */
    List<LaboratoryResultEntity> findByRequestIdInOrderByCreatedAtDesc(java.util.Collection<String> requestIds);

    /** Pending results per patient: count and oldest submission time. */
    @Query("""
            select result.patientAccountId as patientAccountId, count(result) as pending, min(result.createdAt) as oldest
            from LaboratoryResultEntity result
            where result.status = 'PENDING_REVIEW'
              and result.patientAccountId in :patientIds
            group by result.patientAccountId
            """)
    List<PendingByPatient> countPendingByPatient(@Param("patientIds") java.util.Collection<String> patientIds);

    interface PendingByPatient {
        String getPatientAccountId();

        long getPending();

        java.time.Instant getOldest();
    }
}
