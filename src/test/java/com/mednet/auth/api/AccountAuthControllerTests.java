package com.mednet.auth.api;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.mednet.admin.data.PlatformAccountEntity;
import com.mednet.admin.data.PlatformAccountRepository;
import com.mednet.auth.AuthTokenService;
import com.mednet.auth.email.EkdSendEmailService;
import com.mednet.auth.security.AccountSessions;
import com.mednet.auth.security.AuthRateLimitProperties;
import com.mednet.auth.security.AuthRateLimiter;
import com.mednet.auth.security.ClientAddressResolver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountAuthControllerTests {

    private final AuthRateLimitProperties limits = new AuthRateLimitProperties();
    private final AuthRateLimiter limiter = new AuthRateLimiter(limits, Clock.systemUTC());

    @Test
    void successfulRegistrationConfirmsVerificationLinkWasQueuedAndDefaultsToPatient() {
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
        when(email.send(anyString(), anyString(), anyString(), anyString())).thenReturn(true);
        AccountAuthController controller =
                new AccountAuthController(accounts, passwordEncoder, tokens, email, "https://mednet.example.test",
                        limiter, new ClientAddressResolver(limits), mock(AccountSessions.class));

        var response = controller.register(new AccountAuthController.CredentialsRequest(
                address, "Secure-Password-123!", null), new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody().message())
                .contains("verification link will arrive shortly")
                .contains("Resend verification email")
                .doesNotContain("submit these details again");
        verify(accounts).save(argThat(account -> account.getAccountType().equals("PATIENT")
                && account.getVerificationTokenHash().equals("hashed-verification-token")));
        verify(email).send(
                org.mockito.ArgumentMatchers.eq(address),
                org.mockito.ArgumentMatchers.eq("Verify your MedNet email"),
                anyString(),
                anyString());
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
    }
}
