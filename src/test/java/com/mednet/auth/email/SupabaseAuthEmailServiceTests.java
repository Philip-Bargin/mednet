package com.mednet.auth.email;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.mednet.auth.security.SupabaseAdminClient;
import com.mednet.auth.security.SupabaseAdminClient.GeneratedEmailLink;

import static org.assertj.core.api.Assertions.assertThat;
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

        assertThat(message).contains("verification link");
        verify(ekdSend).send(eq("patient@example.test"), eq("Confirm your MedNet account"),
                contains("token_hash=hashed-token"), contains("123456"));
    }

    @Test
    void existingRegistrationDoesNotRevealAccountPresenceOrSendMail() {
        when(supabase.findExistingUserId("patient@example.test")).thenReturn(Optional.of("user-id"));

        String message = emails.register("patient@example.test", "a-strong-password", null);

        assertThat(message).contains("If a new account can be created");
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
                .thenReturn(new GeneratedEmailLink("hashed-token", "signup", null));
        when(ekdSend.send(eq("patient@example.test"), eq("Confirm your MedNet account"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> emails.register("patient@example.test", "a-strong-password", null))
                .isInstanceOf(SupabaseAuthEmailService.EmailDeliveryException.class);
    }
}
