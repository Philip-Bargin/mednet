package com.mednet.admin.data;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminAuditEventRepository extends JpaRepository<AdminAuditEventEntity, String> {
    List<AdminAuditEventEntity> findTop100ByOrderByCreatedAtDesc();

    Page<AdminAuditEventEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Filtered audit page. {@code pattern} ("%term%", lower case) matches the actor, the action (with "."
     * and "_" read as spaces) or the record ID; {@code labelActions} are action codes whose readable label
     * matched the term in the web client.
     */
    @Query("""
            select event from AdminAuditEventEntity event
            where (:resourceType = '' or event.resourceType = :resourceType)
              and (:pattern = ''
                   or lower(event.actorEmail) like :pattern
                   or lower(event.action) like :pattern
                   or lower(replace(replace(event.action, '.', ' '), '_', ' ')) like :pattern
                   or lower(event.resourceId) like :pattern
                   or event.action in :labelActions)
            order by event.createdAt desc
            """)
    Page<AdminAuditEventEntity> search(
            @Param("resourceType") String resourceType,
            @Param("pattern") String pattern,
            @Param("labelActions") Collection<String> labelActions,
            Pageable pageable);

    @Query("select distinct event.resourceType from AdminAuditEventEntity event order by event.resourceType")
    List<String> findResourceTypes();
}
