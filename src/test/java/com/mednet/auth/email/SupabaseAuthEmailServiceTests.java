package com.mednet.auth.email;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.mednet.auth.security.SupabaseAdminClient;
import com.mednet.auth.security.SupabaseAdminClient.GeneratedEmailLink;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupabaseAuthEmailServiceTests {

    private final SupabaseAdminClient supabase = mock(SupabaseAdminClient.class);
    private final EkdSendEmailService ekdSend = mock(EkdSendEmailService.class);
    private final SupabaseAuthEmailService emails =
            new SupabaseAuthEmailService(supabase, ekdSend, "https://mednet.example");

    @Test
    void registrationGeneratesSupabaseTokensAndSendsDirectlyThroughEkdSend() {
        when(supabase.findExistingUserId("patient@example.test")).thenReturn(Optional.empty());
        when(supabase.generateEmailLink(
                eq("signup"), eq("patient@example.test"), eq("a-strong-password"),
                eq("https://mednet.example/auth/callback"), eq("Patient")))
                .thenReturn(new GeneratedEmailLink("hashed-token", "signup", "123456"));
        when(ekdSend.send(eq("patient@example.test"), eq("Confirm your MedNet account"),
                contains("token_hash=hashed-token"), contains("123456"))).thenReturn(true);

        String message = emails.register("patient@example.test", "a-strong-password", "Patient");

        assertThat(message).contains("six-digit verification code");
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(ekdSend).send(eq("patient@example.test"), eq("Confirm your MedNet account"),
                html.capture(), text.capture());
        assertThat(html.getValue())
                .contains("YOUR SIX-DIGIT CODE", "123456", "Continue with secure link", "token_hash=hashed-token")
                .contains("CARE, CONNECTED");
        assertThat(html.getValue().indexOf("123456"))
                .isLessThan(html.getValue().indexOf("Continue with secure link"));
        assertThat(text.getValue())
                .contains("Your six-digit MedNet code is: 123456", "Having trouble with the code?")
                .contains("token_hash=hashed-token");
        assertThat(text.getValue().indexOf("Your six-digit MedNet code is: 123456"))
                .isLessThan(text.getValue().indexOf("Having trouble with the code?"));
    }

    @Test
    void existingRegistrationIsRejectedWithoutSendingAnotherEmail() {
        when(supabase.findExistingUserId("patient@example.test")).thenReturn(Optional.of("user-id"));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> emails.register("patient@example.test", "a-strong-password", null))
                .isInstanceOf(SupabaseAuthEmailService.EmailAlreadyRegisteredException.class)
                .hasMessageContaining("already exists");
        verify(supabase, never()).generateEmailLink(
                eq("signup"), eq("patient@example.test"), eq("a-strong-password"),
                eq("https://mednet.example/auth/callback"), eq(null));
        verify(ekdSend, never()).send(
                eq("patient@example.test"), eq("Confirm your MedNet account"),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void deliveryFailureIsReportedInsteadOfReturningSuccess() {
        when(supabase.findExistingUserId("patient@example.test")).thenReturn(Optional.empty());
        when(supabase.generateEmailLink(
                eq("signup"), eq("patient@example.test"), eq("a-strong-password"),
                eq("https://mednet.example/auth/callback"), eq(null)))
                .thenReturn(new GeneratedEmailLink("hashed-token", "signup", "123456"));
        when(ekdSend.send(eq("patient@example.test"), eq("Confirm your MedNet account"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        assertThatThrownBy(
                () -> emails.register("patient@example.test", "a-strong-password", null))
                .isInstanceOf(SupabaseAuthEmailService.EmailDeliveryException.class);
    }

    @Test
    void missingVerificationCodeDoesNotSendALinkOnlyEmail() {
        when(supabase.findExistingUserId("patient@example.test")).thenReturn(Optional.empty());
        when(supabase.generateEmailLink(
                eq("signup"), eq("patient@example.test"), eq("a-strong-password"),
                eq("https://mednet.example/auth/callback"), eq(null)))
                .thenReturn(new GeneratedEmailLink("hashed-token", "signup", null));

        assertThatThrownBy(() -> emails.register("patient@example.test", "a-strong-password", null))
                .isInstanceOf(SupabaseAdminClient.SupabaseAdminException.class)
                .hasMessageContaining("six-digit email verification code");
        verify(ekdSend, never()).send(
                eq("patient@example.test"), eq("Confirm your MedNet account"),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
    }
}
