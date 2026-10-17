package com.mednet.service.api;

import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mednet.service.app.PatientServiceRequestService.AdminRequestSummary;
import com.mednet.service.app.PatientServiceRequestService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@RestController
@RequestMapping("/api/v1/admin/service-requests")
@ConditionalOnProperty(prefix = "spring.datasource", name = "url")
public class AdminServiceRequestController {

    private final PatientServiceRequestService service;

    public AdminServiceRequestController(PatientServiceRequestService service) {
        this.service = service;
    }

    @GetMapping
    public List<AdminRequestSummary> requests(@RequestParam String type, Authentication actor) {
        return service.listForAdministrator(type, actorEmail(actor));
    }

    /** With {@code page}: paged and complete (Phase 5D); without it the original first-100 list. */
    @GetMapping(params = "page")
    public Page<AdminRequestSummary> requestsPage(
            @RequestParam String type,
            @RequestParam int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(name = "status", required = false) List<String> statuses,
            Authentication actor) {
        return service.pageForAdministrator(type, statuses, actorEmail(actor), page, size);
    }

    @PatchMapping("/{id}/status")
    public AdminRequestSummary updateStatus(
            @PathVariable String id,
            @Valid @RequestBody StatusRequest request,
            Authentication actor) {
        return service.updateStatus(id, request.status(), actorEmail(actor));
    }

    @PatchMapping("/{id}/assignment")
    public PatientServiceRequestService.PartnerAssignment assignStaff(
            @PathVariable String id,
            @Valid @RequestBody AssignmentRequest request,
            Authentication actor) {
        return service.assignStaff(id, request.staffAccountId(), actorEmail(actor));
    }

    private static String actorEmail(Authentication actor) {
        return actor.getName();
    }

    public record StatusRequest(
            @NotBlank @Pattern(regexp = "(?i)IN_PROGRESS|CANCELLED") String status) {
    }

    public record AssignmentRequest(@NotBlank @org.hibernate.validator.constraints.UUID String staffAccountId) {
    }
}
