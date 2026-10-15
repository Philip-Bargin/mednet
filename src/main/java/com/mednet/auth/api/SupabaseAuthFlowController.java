package com.mednet.auth.api;

import java.util.Locale;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.mednet.admin.data.PlatformAccountEntity;
import com.mednet.admin.data.PlatformAccountRepository;
import com.mednet.auth.email.SupabaseAuthEmailService;
import com.mednet.auth.email.SupabaseAuthEmailService.EmailAlreadyRegisteredException;
import com.mednet.auth.email.SupabaseAuthEmailService.EmailDeliveryException;
import com.mednet.auth.security.AuthRateLimiter;
import com.mednet.auth.security.ClientAddressResolver;
import com.mednet.auth.security.SupabaseAdminClient;
import com.mednet.auth.security.SupabaseAdminClient.SupabaseAdminException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1/auth")
@ConditionalOnProperty(prefix = "mednet.supabase", name = "auth-enabled", havingValue = "true")
public class SupabaseAuthFlowController {

    private static final String INVALID_CREDENTIALS = "Invalid email or password";

    private final PlatformAccountRepository accounts;
    private final PasswordEncoder passwordEncoder;
    private final SupabaseAdminClient supabaseAdmin;
    private final SupabaseAuthEmailService authEmails;
    private final AuthRateLimiter limiter;
    private final ClientAddressResolver clients;
    private final String configuredAdminEmail;
    private final String configuredAdminPassword;

    public SupabaseAuthFlowController(
            PlatformAccountRepository accounts,
            PasswordEncoder passwordEncoder,
            SupabaseAdminClient supabaseAdmin,
            SupabaseAuthEmailService authEmails,
            AuthRateLimiter limiter,
            ClientAddressResolver clients,
            @Value("${mednet.admin.email:}") String configuredAdminEmail,
            @Value("${mednet.admin.password:}") String configuredAdminPassword) {
        this.accounts = accounts;
        this.passwordEncoder = passwordEncoder;
        this.supabaseAdmin = supabaseAdmin;
        this.authEmails = authEmails;
        this.limiter = limiter;
        this.clients = clients;
        this.configuredAdminEmail = normalize(configuredAdminEmail);
        this.configuredAdminPassword = configuredAdminPassword == null ? "" : configuredAdminPassword;
    }

    @GetMapping("/verification-mode")
    public VerificationModeResponse verificationMode() {
        return new VerificationModeResponse("supabase");
    }

    @PostMapping("/register")
    public ResponseEntity<MigrationResponse> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest) {
        String email = normalize(request.email());
        limitEmailDelivery(email, httpRequest);
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds 72 bytes");
        }
        if (accounts.findFirstByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account with this email already exists. Sign in or reset your password.");
        }
        try {
            return ResponseEntity.accepted().body(new MigrationResponse(
                    authEmails.register(email, request.password(), request.displayName())));
        } catch (EmailAlreadyRegisteredException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
        } catch (SupabaseAdminException | EmailDeliveryException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Account registration is temporarily unavailable. Please try again later.",
                    exception);
        }
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<MigrationResponse> resendVerification(
            @Valid @RequestBody EmailRequest request,
            HttpServletRequest httpRequest) {
        String email = normalize(request.email());
        limitEmailDelivery(email, httpRequest);
        try {
            return ResponseEntity.accepted()
                    .body(new MigrationResponse(authEmails.resendVerification(email)));
        } catch (SupabaseAdminException | EmailDeliveryException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Verification email is temporarily unavailable. Please try again later.",
                    exception);
        }
    }

    @PostMapping("/migrate-legacy")
    @Transactional
    public ResponseEntity<MigrationResponse> migrateLegacyAccount(
            @Valid @RequestBody MigrationRequest request,
            HttpServletRequest httpRequest) {
        String email = normalize(request.email());
        String accountKey = AuthRateLimiter.accountKey(email);
        String clientAddress = clients.resolve(httpRequest);
        var limits = limiter.properties();
        limiter.check("sign-in-failures", "account", accountKey, limits.getSignInFailuresPerAccount());
        limiter.check("sign-in-failures", "client", clientAddress, limits.getSignInFailuresPerClient());

        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(email).orElse(null);
        boolean configuredAdminLogin = configuredAdminEmail.equals(email)
                && !configuredAdminPassword.isBlank()
                && MessageDigest.isEqual(
                        request.password().getBytes(StandardCharsets.UTF_8),
                        configuredAdminPassword.getBytes(StandardCharsets.UTF_8));
        boolean validAccountPassword = account != null
                && account.isEmailVerified()
                && !"SUSPENDED".equals(account.getStatus())
                && account.getPasswordHash() != null
                && passwordEncoder.matches(request.password(), account.getPasswordHash());

        if (!validAccountPassword && !configuredAdminLogin) {
            limiter.record("sign-in-failures", "account", accountKey, limits.getSignInFailuresPerAccount());
            limiter.record("sign-in-failures", "client", clientAddress, limits.getSignInFailuresPerClient());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
        }
        if (account != null && StringUtils.hasText(account.getSupabaseUserId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "This account is already linked; use password recovery if sign-in fails");
        }

        String supabaseUserId;
        try {
            if (configuredAdminLogin && !validAccountPassword) {
                if (account == null) {
                    account = new PlatformAccountEntity(UUID.randomUUID().toString(), email, "SUPER_ADMIN");
                }
                account.changeAccountType("SUPER_ADMIN");
                account.setEmailVerified(true);
                supabaseUserId = supabaseAdmin.createUserWithPassword(
                        email, request.password(), account.getDisplayName());
            } else {
                supabaseUserId = supabaseAdmin.migrateLegacyUser(
                        email, account.getPasswordHash(), request.password(), account.getDisplayName());
            }
        } catch (SupabaseAdminException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Account migration is temporarily unavailable. Please try again later.",
                    exception);
        }

        account.linkSupabaseUser(supabaseUserId);
        accounts.saveAndFlush(account);
        limiter.reset("sign-in-failures", "account", accountKey);
        limiter.reset("sign-in-failures", "client", clientAddress);
        return ResponseEntity.ok(new MigrationResponse("Your account has been migrated. Sign in again to continue."));
    }

    @PostMapping("/prepare-reset")
    @Transactional
    public ResponseEntity<MigrationResponse> prepareLegacyPasswordReset(
            @Valid @RequestBody EmailRequest request,
            HttpServletRequest httpRequest) {
        String email = normalize(request.email());
        String accountKey = AuthRateLimiter.accountKey(email);
        String clientAddress = clients.resolve(httpRequest);
        var limits = limiter.properties();
        limiter.consume("email-delivery", "account", accountKey, limits.getEmailDeliveryPerAccount());
        limiter.consume("email-delivery", "client", clientAddress, limits.getEmailDeliveryPerClient());

        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(email).orElse(null);
        if (account == null) {
            try {
                return ResponseEntity.accepted().body(new MigrationResponse(authEmails.sendRecovery(email)));
            } catch (SupabaseAdminException | EmailDeliveryException exception) {
                throw recoveryUnavailable(exception);
            }
        }
        if (!"ACTIVE".equals(account.getStatus()) || !account.isEmailVerified()) {
            return ResponseEntity.accepted().body(new MigrationResponse(authEmailsRecoveryMessage()));
        }

        try {
            if (!StringUtils.hasText(account.getSupabaseUserId())) {
                String supabaseUserId;
                if (account.getPasswordHash() != null) {
                    supabaseUserId = supabaseAdmin.migrateLegacyUser(
                            email, account.getPasswordHash(), null, account.getDisplayName());
                } else {
                    supabaseUserId = supabaseAdmin.findExistingUserId(email).orElse(null);
                    if (supabaseUserId == null) {
                        return ResponseEntity.accepted()
                                .body(new MigrationResponse(authEmailsRecoveryMessage()));
                    }
                }
                account.linkSupabaseUser(supabaseUserId);
                accounts.saveAndFlush(account);
            }
            return ResponseEntity.accepted().body(new MigrationResponse(authEmails.sendRecovery(email)));
        } catch (SupabaseAdminException | EmailDeliveryException exception) {
            throw recoveryUnavailable(exception);
        }
    }

    private static ResponseStatusException recoveryUnavailable(RuntimeException exception) {
        return new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Password recovery is temporarily unavailable. Please try again later.",
                exception);
    }

    private void limitEmailDelivery(String email, HttpServletRequest request) {
        var limits = limiter.properties();
        limiter.consume("email-delivery", "account", AuthRateLimiter.accountKey(email),
                limits.getEmailDeliveryPerAccount());
        limiter.consume("email-delivery", "client", clients.resolve(request), limits.getEmailDeliveryPerClient());
    }

    private static String authEmailsRecoveryMessage() {
        return "If the account exists, password recovery instructions have been sent.";
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public record MigrationRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 256) String password) {
    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 12, max = 256) String password,
            @Size(max = 160) String displayName) {
    }

    public record MigrationResponse(String message) {
    }

    public record VerificationModeResponse(String mode) {
    }

    public record EmailRequest(@NotBlank @Email @Size(max = 254) String email) {
    }
}
