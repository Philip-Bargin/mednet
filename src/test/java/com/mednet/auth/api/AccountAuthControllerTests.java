package com.mednet.auth.api;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.mednet.admin.data.PlatformAccountEntity;
import com.mednet.admin.data.PlatformAccountRepository;
import com.mednet.auth.AuthTokenService;
import com.mednet.auth.email.EkdSendEmailService;
import com.mednet.auth.security.AccountSessions;
import com.mednet.auth.security.AuthRateLimitProperties;
import com.mednet.auth.security.AuthRateLimiter;
import com.mednet.auth.security.ClientAddressResolver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountAuthControllerTests {

    private final AuthRateLimitProperties limits = new AuthRateLimitProperties();
    private final AuthRateLimiter limiter = new AuthRateLimiter(limits, Clock.systemUTC());

    @Test
    void successfulRegistrationSendsCodeFirstVerificationAndDefaultsToPatient() {
        PlatformAccountRepository accounts = mock(PlatformAccountRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AuthTokenService tokens = mock(AuthTokenService.class);
        EkdSendEmailService email = mock(EkdSendEmailService.class);
        String address = "new-patient@example.test";
        when(accounts.findFirstByEmailIgnoreCase(address)).thenReturn(Optional.empty());
        when(accounts.save(any(PlatformAccountEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(passwordEncoder.encode(anyString())).thenReturn("password-hash");
        when(tokens.issue(any())).thenReturn(new AuthTokenService.IssuedToken(
                "verification-token",
                "hashed-verification-token",
                Instant.now().plusSeconds(3600)));
        when(tokens.issueNumericCode(any())).thenReturn(new AuthTokenService.IssuedToken(
                "012345", "unused-code-hash", Instant.now().plusSeconds(600)));
        when(passwordEncoder.encode("email-verification-otp:012345")).thenReturn("hashed-code");
        when(email.send(anyString(), anyString(), anyString(), anyString())).thenReturn(true);
        AccountAuthController controller =
                new AccountAuthController(accounts, passwordEncoder, tokens, email, "https://mednet.example.test",
                        limiter, new ClientAddressResolver(limits), mock(AccountSessions.class));

        var response = controller.register(new AccountAuthController.CredentialsRequest(
                address, "Secure-Password-123!", null), new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody().message())
                .contains("six-digit verification code")
                .contains("secure link");
        verify(accounts).save(argThat(account -> account.getAccountType().equals("PATIENT")
                && account.getVerificationTokenHash().equals("hashed-verification-token")
                && account.getVerificationCodeHash().equals("hashed-code")));
        org.mockito.ArgumentCaptor<String> html = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.ArgumentCaptor<String> text = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(email).send(
                org.mockito.ArgumentMatchers.eq(address),
                org.mockito.ArgumentMatchers.eq("Verify your MedNet email"),
                html.capture(),
                text.capture());
        assertThat(html.getValue())
                .contains("YOUR SIX-DIGIT CODE", "012345", "Continue with secure link");
        assertThat(html.getValue().indexOf("012345"))
                .isLessThan(html.getValue().indexOf("Continue with secure link"));
        assertThat(text.getValue())
                .contains("Your six-digit MedNet code is: 012345")
                .contains("https://mednet.example.test/verify?email=new-patient%40example.test");
    }

    @Test
    void registrationPersistsVerificationBeforeSendingAndReportsDeliveryFailure() {
        PlatformAccountRepository accounts = mock(PlatformAccountRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AuthTokenService tokens = mock(AuthTokenService.class);
        EkdSendEmailService email = mock(EkdSendEmailService.class);
        String address = "new-patient@example.test";
        when(accounts.findFirstByEmailIgnoreCase(address)).thenReturn(Optional.empty());
        when(accounts.save(any(PlatformAccountEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(passwordEncoder.encode(anyString())).thenReturn("password-hash");
        when(tokens.issue(any())).thenReturn(new AuthTokenService.IssuedToken(
                "verification-token",
                "hashed-verification-token",
                Instant.now().plusSeconds(3600)));
        when(tokens.issueNumericCode(any())).thenReturn(new AuthTokenService.IssuedToken(
                "012345", "unused-code-hash", Instant.now().plusSeconds(600)));
        when(passwordEncoder.encode("email-verification-otp:012345")).thenReturn("hashed-code");
        when(email.send(anyString(), anyString(), anyString(), anyString())).thenReturn(false);
        AccountAuthController controller =
                new AccountAuthController(accounts, passwordEncoder, tokens, email, "https://mednet.example.test",
                        limiter, new ClientAddressResolver(limits), mock(AccountSessions.class));

        var response = controller.register(new AccountAuthController.CredentialsRequest(
                address, "Secure-Password-123!", null), new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody().message()).contains("Verification email could not be sent");
        var order = inOrder(accounts, email);
        order.verify(accounts).save(any(PlatformAccountEntity.class));
        order.verify(email).send(anyString(), anyString(), anyString(), anyString());
        order.verify(accounts).save(argThat(account -> account.getVerificationTokenHash() == null
                && account.getVerificationCodeHash() == null));
    }

    @Test
    void existingAccountCannotRegisterAgain() {
        PlatformAccountRepository accounts = mock(PlatformAccountRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AuthTokenService tokens = mock(AuthTokenService.class);
        EkdSendEmailService email = mock(EkdSendEmailService.class);
        String address = "existing@example.test";
        PlatformAccountEntity existing = new PlatformAccountEntity("id", address, "PATIENT");
        when(accounts.findFirstByEmailIgnoreCase(address)).thenReturn(Optional.of(existing));
        AccountAuthController controller =
                new AccountAuthController(accounts, passwordEncoder, tokens, email, "https://mednet.example.test",
                        limiter, new ClientAddressResolver(limits), mock(AccountSessions.class));

        assertThatThrownBy(() -> controller.register(
                new AccountAuthController.CredentialsRequest(address, "Secure-Password-123!", null),
                new MockHttpServletRequest()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already exists");
        verify(email, never()).send(anyString(), anyString(), anyString(), anyString());
        verify(accounts, never()).save(any(PlatformAccountEntity.class));
    }

    @Test
    void verificationCodeConfirmsEmailAndInvalidatesTheFallbackLink() {
        PlatformAccountRepository accounts = mock(PlatformAccountRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        AuthTokenService tokens = mock(AuthTokenService.class);
        String address = "pending@example.test";
        PlatformAccountEntity pending = new PlatformAccountEntity("id", address, "PATIENT");
        pending.setVerificationToken("link-hash", Instant.now().plusSeconds(3600));
        pending.setVerificationCode("code-hash", Instant.now().plusSeconds(600));
        when(accounts.findFirstByEmailIgnoreCase(address)).thenReturn(Optional.of(pending));
        when(passwordEncoder.matches("email-verification-otp:012345", "code-hash")).thenReturn(true);
        AccountAuthController controller =
                new AccountAuthController(accounts, passwordEncoder, tokens, mock(EkdSendEmailService.class),
                        "https://mednet.example.test", limiter, new ClientAddressResolver(limits),
                        mock(AccountSessions.class));

        var response = controller.verifyCode(
                new AccountAuthController.VerificationCodeRequest(address, "012345"),
                new MockHttpServletRequest());

        assertThat(response.message()).contains("Email verified");
        assertThat(pending.isEmailVerified()).isTrue();
        assertThat(pending.getVerificationCodeHash()).isNull();
        assertThat(pending.getVerificationTokenHash()).isNull();
        verify(accounts).save(pending);
    }
}
