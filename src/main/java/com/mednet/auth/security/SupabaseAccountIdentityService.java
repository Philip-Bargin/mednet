package com.mednet.auth.security;

import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.mednet.admin.data.PlatformAccountEntity;
import com.mednet.admin.data.PlatformAccountRepository;
import com.mednet.provider.data.ProviderApplicationRepository;

@Service
@ConditionalOnProperty(prefix = "mednet.supabase", name = "auth-enabled", havingValue = "true")
public class SupabaseAccountIdentityService {

    private final PlatformAccountRepository accounts;
    private final ProviderApplicationRepository providerApplications;
    private final SupabaseAdminClient supabaseAdmin;
    private final String configuredAdminEmail;

    public SupabaseAccountIdentityService(
            PlatformAccountRepository accounts,
            ProviderApplicationRepository providerApplications,
            SupabaseAdminClient supabaseAdmin,
            @Value("${mednet.admin.email:}") String configuredAdminEmail) {
        this.accounts = accounts;
        this.providerApplications = providerApplications;
        this.supabaseAdmin = supabaseAdmin;
        this.configuredAdminEmail = configuredAdminEmail == null
                ? ""
                : configuredAdminEmail.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public Identity resolve(String supabaseUserId, String email) {
        if (!StringUtils.hasText(supabaseUserId) || !StringUtils.hasText(email)) {
            throw new BadCredentialsException("A verified Supabase identity is required");
        }
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        PlatformAccountEntity account = accounts.findFirstBySupabaseUserId(supabaseUserId).orElse(null);
        if (account == null) {
            account = accounts.findFirstByEmailIgnoreCase(normalizedEmail).orElse(null);
            if (account == null) {
                String role = configuredAdminEmail.equals(normalizedEmail) ? "SUPER_ADMIN" : "PATIENT";
                account = new PlatformAccountEntity(UUID.randomUUID().toString(), normalizedEmail, role);
            }
            if (StringUtils.hasText(account.getSupabaseUserId())
                    && !account.getSupabaseUserId().equals(supabaseUserId)) {
                throw new BadCredentialsException("This MedNet account is linked to another Supabase identity");
            }
            if (!supabaseAdmin.isEmailConfirmed(supabaseUserId, normalizedEmail)) {
                throw new BadCredentialsException("The Supabase email address has not been verified");
            }
            account.linkSupabaseUser(supabaseUserId);
        } else if (!account.getEmail().equalsIgnoreCase(normalizedEmail)) {
            if (!supabaseAdmin.isEmailConfirmed(supabaseUserId, normalizedEmail)) {
                throw new BadCredentialsException("The Supabase email address has not been verified");
            }
            account.changeEmail(normalizedEmail);
            account.setEmailVerified(true);
        }

        if ("SUSPENDED".equals(account.getStatus())) {
            throw new BadCredentialsException("This MedNet account is suspended");
        }
        if (configuredAdminEmail.equals(normalizedEmail)) {
            account.changeAccountType("SUPER_ADMIN");
        }
        accounts.saveAndFlush(account);
        return new Identity(account.getEmail(), roleFor(account));
    }

    private String roleFor(PlatformAccountEntity account) {
        if (account.getAccountType().equals("PATIENT") || account.getAccountType().equals("PROVIDER")) {
            boolean approvedProvider = providerApplications
                    .findFirstByEmailIgnoreCaseAndStatusOrderByReviewedAtDesc(account.getEmail(), "APPROVED")
                    .isPresent();
            return approvedProvider ? "PROVIDER" : "PATIENT";
        }
        return account.getAccountType();
    }

    public record Identity(String email, String role) {
    }
}
