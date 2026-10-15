package com.mednet.auth.api;

import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.mednet.admin.data.PlatformAccountEntity;
import com.mednet.admin.data.PlatformAccountRepository;
import com.mednet.auth.AuthTokenService;
import com.mednet.auth.AuthTokenService.IssuedToken;
import com.mednet.auth.email.AuthEmailTemplate;
import com.mednet.auth.email.EkdSendEmailService;
import com.mednet.auth.security.AccountSessions;
import com.mednet.auth.security.AuthRateLimitProperties;
import com.mednet.auth.security.AuthRateLimiter;
import com.mednet.auth.security.ClientAddressResolver;

@RestController
@RequestMapping("/api/v1/auth")
@ConditionalOnExpression("'${spring.datasource.url:}' != ''")
public class AccountAuthController {

    private static final Duration VERIFICATION_LIFETIME = Duration.ofHours(24);
    private static final Duration VERIFICATION_CODE_LIFETIME = Duration.ofMinutes(10);
    private static final Duration RESET_CODE_LIFETIME = Duration.ofMinutes(10);
    private static final Duration RESET_TICKET_LIFETIME = Duration.ofMinutes(10);
    private static final int MAX_RESET_CODE_ATTEMPTS = 5;
    private final PlatformAccountRepository accounts;
    private final PasswordEncoder passwordEncoder;
    private final AuthTokenService tokens;
    private final EkdSendEmailService email;
    private final String publicUrl;
    private final AuthRateLimiter limiter;
    private final ClientAddressResolver clients;
    private final AccountSessions sessions;

    public AccountAuthController(
            PlatformAccountRepository accounts,
            PasswordEncoder passwordEncoder,
            AuthTokenService tokens,
            EkdSendEmailService email,
            @org.springframework.beans.factory.annotation.Value(
                    "${MEDNET_PUBLIC_URL:${NEXTAUTH_URL:http://localhost:3000}}") String publicUrl,
            AuthRateLimiter limiter,
            ClientAddressResolver clients,
            AccountSessions sessions) {
        this.accounts = accounts;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.email = email;
        this.publicUrl = publicUrl.replaceAll("/$", "");
        this.limiter = limiter;
        this.clients = clients;
        this.sessions = sessions;
    }

    @PostMapping("/register")
    public ResponseEntity<MessageResponse> register(
            @Valid @RequestBody CredentialsRequest request, HttpServletRequest httpRequest) {
        String normalizedEmail = normalize(request.email());
        validatePassword(request.password());
        limitEmailDelivery(httpRequest, normalizedEmail);
        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (account == null) {
            account = new PlatformAccountEntity(UUID.randomUUID().toString(), normalizedEmail,
                    requestedAccountType(request.accountType()));
            account.setPasswordHash(passwordEncoder.encode(request.password()));
        } else {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An account with this email already exists. Sign in or reset your password.");
        }
        if (!sendVerification(account)) {
            return verificationDeliveryFailure();
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(registrationResponse());
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<MessageResponse> resendVerification(
            @Valid @RequestBody EmailRequest request, HttpServletRequest httpRequest) {
        String normalizedEmail = normalize(request.email());
        limitEmailDelivery(httpRequest, normalizedEmail);
        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (account != null && !account.isEmailVerified()) {
            if (!sendVerification(account)) {
                return verificationDeliveryFailure();
            }
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(resendVerificationResponse());
    }

    @GetMapping("/verify")
    @Transactional
    public MessageResponse verify(
            @RequestParam @NotBlank @Email @Size(max = 254) String email,
            @RequestParam @NotBlank @Size(min = 43, max = 43) @Pattern(regexp = "[A-Za-z0-9_-]{43}") String token,
            HttpServletRequest httpRequest) {
        AuthRateLimitProperties limits = limiter.properties();
        limiter.consume("verification-link", "client", clients.resolve(httpRequest), limits.getLinkChecksPerClient());
        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(normalize(email)).orElseThrow(
                () -> new AuthRequestException("Verification link is invalid or expired"));
        if (account.getVerificationTokenHash() == null
                || !account.getVerificationTokenHash().equals(tokens.hash(token))
                || account.getVerificationTokenExpiresAt() == null
                || account.getVerificationTokenExpiresAt().isBefore(Instant.now())) {
            throw new AuthRequestException("Verification link is invalid or expired");
        }
        account.verifyEmail();
        accounts.save(account);
        return new MessageResponse("Email verified. You can now sign in.");
    }

    @PostMapping("/verify-code")
    @Transactional
    public MessageResponse verifyCode(
            @Valid @RequestBody VerificationCodeRequest request, HttpServletRequest httpRequest) {
        String normalizedEmail = normalize(request.email());
        limitVerificationCodeChecks(httpRequest, normalizedEmail);
        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(normalizedEmail).orElseThrow(
                () -> new AuthRequestException("Verification code is invalid or expired"));
        if (account.getVerificationCodeHash() == null
                || account.getVerificationCodeExpiresAt() == null
                || account.getVerificationCodeExpiresAt().isBefore(Instant.now())
                || !passwordEncoder.matches(
                        "email-verification-otp:" + request.code().trim(),
                        account.getVerificationCodeHash())) {
            throw new AuthRequestException("Verification code is invalid or expired");
        }
        account.verifyEmail();
        accounts.save(account);
        return new MessageResponse("Email verified. You can now sign in.");
    }

    @PostMapping("/forgot-password")
    @Transactional
    public ResponseEntity<MessageResponse> forgotPassword(
            @Valid @RequestBody EmailRequest request, HttpServletRequest httpRequest) {
        String normalizedEmail = normalize(request.email());
        limitEmailDelivery(httpRequest, normalizedEmail);
        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (account != null && account.isEmailVerified()) {
            IssuedToken code = tokens.issueNumericCode(RESET_CODE_LIFETIME);
            account.setPasswordResetCode(
                    tokens.hash("password-reset-otp:" + code.raw()), code.expiresAt());
            accounts.save(account);
            String link = publicUrl + "/reset?email=" + encode(account.getEmail());
            AuthEmailTemplate.Content content =
                    AuthEmailTemplate.codeFirst("Reset your MedNet password", code.raw(), link);
            boolean sent = email.send(
                    account.getEmail(), "Your MedNet password reset code", content.html(), content.text());
            if (!sent) {
                account.clearPasswordResetToken();
                accounts.save(account);
            }
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(genericResponse());
    }

    @PostMapping("/reset-password/verify")
    @Transactional
    public ResponseEntity<ResetVerificationResponse> verifyPasswordResetCode(
            @Valid @RequestBody ResetCodeRequest request, HttpServletRequest httpRequest) {
        String normalizedEmail = normalize(request.email());
        limitCodeChecks(httpRequest, normalizedEmail);
        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (account == null || account.isPasswordResetVerified()) {
            return invalidResetCode();
        }

        if (account.getPasswordResetTokenHash() == null
                || account.getPasswordResetTokenExpiresAt() == null
                || account.getPasswordResetTokenExpiresAt().isBefore(Instant.now())) {
            account.clearPasswordResetToken();
            accounts.save(account);
            return invalidResetCode();
        }

        String code = request.code() == null ? "" : request.code().trim();
        if (!account.getPasswordResetTokenHash().equals(tokens.hash("password-reset-otp:" + code))) {
            if (account.recordPasswordResetAttempt() >= MAX_RESET_CODE_ATTEMPTS) {
                account.clearPasswordResetToken();
            }
            accounts.save(account);
            return invalidResetCode();
        }

        IssuedToken ticket = tokens.issue(RESET_TICKET_LIFETIME);
        account.setPasswordResetTicket(
                tokens.hash("password-reset-ticket:" + ticket.raw()), ticket.expiresAt());
        accounts.save(account);
        return ResponseEntity.ok(new ResetVerificationResponse(ticket.raw(), "Code verified."));
    }

    @PostMapping("/reset-password")
    @Transactional
    public MessageResponse resetPassword(
            @Valid @RequestBody ResetPasswordRequest request, HttpServletRequest httpRequest) {
        validatePassword(request.password());
        String normalizedEmail = normalize(request.email());
        limitCodeChecks(httpRequest, normalizedEmail);
        PlatformAccountEntity account = accounts.findFirstByEmailIgnoreCase(normalizedEmail).orElseThrow(
                () -> new AuthRequestException("Reset link is invalid or expired"));
        String ticket = request.token() == null ? "" : request.token();
        if (!account.isPasswordResetVerified()
                || account.getPasswordResetTokenHash() == null
                || !account.getPasswordResetTokenHash()
                        .equals(tokens.hash("password-reset-ticket:" + ticket))
                || account.getPasswordResetTokenExpiresAt() == null
                || account.getPasswordResetTokenExpiresAt().isBefore(Instant.now())) {
            throw new AuthRequestException("Reset link is invalid or expired");
        }
        account.setPasswordHash(passwordEncoder.encode(request.password()));
        account.clearPasswordResetToken();
        accounts.save(account);
        // Anyone still signed in with the old password is signed out.
        sessions.endAll(account.getEmail());
        email.send(account.getEmail(), "Your MedNet password was changed",
                "<p>Your MedNet password was changed successfully.</p>",
                "Your MedNet password was changed successfully.");
        return new MessageResponse("Password updated. You can now sign in.");
    }

    /** Sign-up, resend and forgot-password all send email: one allowance per address and per client. */
    private void limitEmailDelivery(HttpServletRequest httpRequest, String normalizedEmail) {
        AuthRateLimitProperties limits = limiter.properties();
        limiter.consume("email-delivery", "client", clients.resolve(httpRequest), limits.getEmailDeliveryPerClient());
        limiter.consume("email-delivery", "account", AuthRateLimiter.accountKey(normalizedEmail),
                limits.getEmailDeliveryPerAccount());
    }

    /**
     * Reset-code and reset-ticket checks. The per-address allowance holds however many client addresses
     * are used, so distributed guessing of the 6-digit code gets the same few attempts per hour.
     */
    private void limitCodeChecks(HttpServletRequest httpRequest, String normalizedEmail) {
        AuthRateLimitProperties limits = limiter.properties();
        limiter.consume("reset-code", "client", clients.resolve(httpRequest), limits.getCodeChecksPerClient());
        limiter.consume("reset-code", "account", AuthRateLimiter.accountKey(normalizedEmail),
                limits.getCodeChecksPerAccount());
    }

    private void limitVerificationCodeChecks(HttpServletRequest httpRequest, String normalizedEmail) {
        AuthRateLimitProperties limits = limiter.properties();
        limiter.consume("verification-code", "client", clients.resolve(httpRequest),
                limits.getCodeChecksPerClient());
        limiter.consume("verification-code", "account", AuthRateLimiter.accountKey(normalizedEmail),
                limits.getCodeChecksPerAccount());
    }

    private boolean sendVerification(PlatformAccountEntity account) {
        IssuedToken token = tokens.issue(VERIFICATION_LIFETIME);
        IssuedToken code = tokens.issueNumericCode(VERIFICATION_CODE_LIFETIME);
        account.setVerificationToken(token.hash(), token.expiresAt());
        account.setVerificationCode(
                passwordEncoder.encode("email-verification-otp:" + code.raw()), code.expiresAt());
        accounts.save(account);
        String link = publicUrl + "/verify?email=" + encode(account.getEmail()) + "&token=" + encode(token.raw());
        AuthEmailTemplate.Content content =
                AuthEmailTemplate.codeFirst("Confirm your MedNet email", code.raw(), link);
        boolean sent = email.send(account.getEmail(), "Verify your MedNet email", content.html(), content.text());
        if (!sent) {
            account.clearVerificationTokens();
            accounts.save(account);
        }
        return sent;
    }

    private static String normalize(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) {
            throw new AuthRequestException("A valid email address is required");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static void validatePassword(String password) {
        if (password == null
                || password.length() < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new AuthRequestException("Password must be at least 12 characters and no more than 72 UTF-8 bytes");
        }
    }

    private static String encode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static MessageResponse genericResponse() {
        return new MessageResponse(
                "If an account exists for this email, password reset instructions will arrive shortly.");
    }

    private static MessageResponse registrationResponse() {
        return new MessageResponse(
                "Thanks for signing up. A six-digit verification code has been sent. If you have trouble with the code, use the secure link in the email.");
    }

    private static MessageResponse resendVerificationResponse() {
        return new MessageResponse(
                "If an account with this email needs verification, we will send a new six-digit code shortly.");
    }

    private static ResponseEntity<MessageResponse> verificationDeliveryFailure() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new MessageResponse("Verification email could not be sent. Please try again shortly."));
    }

    private static ResponseEntity<ResetVerificationResponse> invalidResetCode() {
        return ResponseEntity.badRequest()
                .body(new ResetVerificationResponse(null, "The code is invalid or expired. Request a new code."));
    }

    public record CredentialsRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 12, max = 72) String password,
            @Size(max = 16) String accountType) {
    }

    public record EmailRequest(@NotBlank @Email @Size(max = 254) String email) {
    }

    public record ResetCodeRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Pattern(regexp = "\\d{6}") String code) {
    }

    public record VerificationCodeRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Pattern(regexp = "\\d{6}") String code) {
    }

    public record ResetVerificationResponse(String token, String message) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 128) String token,
            @NotBlank @Size(min = 12, max = 72) String password) {
    }

    public record MessageResponse(String message) {
    }

    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class AuthRequestException extends RuntimeException {
        public AuthRequestException(String message) {
            super(message);
        }
    }

    private static String requestedAccountType(String accountType) {
        if (accountType == null || accountType.isBlank())
            return "PATIENT";
        String normalized = accountType.trim().toUpperCase(Locale.ROOT);
        if (!normalized.equals("PATIENT") && !normalized.equals("PROVIDER")) {
            throw new AuthRequestException("Account type must be PATIENT or PROVIDER");
        }
        return normalized;
    }
}
