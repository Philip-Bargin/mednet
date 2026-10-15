package com.mednet.auth.security;

import java.util.Map;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SupabaseAdminClientTests {

    @Test
    void userIdsAreNormalizedAsUuids() {
        assertThat(SupabaseAdminClient.parseUserId("A1B2C3D4-E5F6-47A8-9B0C-D1E2F3A4B5C6"))
                .isEqualTo("a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6");
    }

    @Test
    void invalidUserIdsFailExplicitly() {
        assertThatThrownBy(() -> SupabaseAdminClient.parseUserId("not-a-user-id"))
                .isInstanceOf(SupabaseAdminClient.SupabaseAdminException.class)
                .hasMessage("Supabase returned an invalid user ID");
    }

    @Test
    void parsesSixDigitCodeAndTokensFromTopLevelResponse() {
        SupabaseAdminClient.GeneratedEmailLink link = SupabaseAdminClient.parseGeneratedEmailLink(Map.of(
                "hashed_token", "hashed-token",
                "verification_type", "signup",
                "email_otp", "012345"));

        assertThat(link.hashedToken()).isEqualTo("hashed-token");
        assertThat(link.verificationType()).isEqualTo("signup");
        assertThat(link.emailOtp()).isEqualTo("012345");
    }

    @Test
    void readsCodeFromNestedPropertiesResponse() {
        SupabaseAdminClient.GeneratedEmailLink link = SupabaseAdminClient.parseGeneratedEmailLink(Map.of(
                "hashed_token", "hashed-token",
                "verification_type", "signup",
                "properties", Map.of("email_otp", "123456")));

        assertThat(link.emailOtp()).isEqualTo("123456");
    }

    @Test
    void rejectsResponsesWithoutASixDigitCode() {
        assertThatThrownBy(() -> SupabaseAdminClient.parseGeneratedEmailLink(Map.of(
                "hashed_token", "hashed-token",
                "verification_type", "signup",
                "email_otp", "not-a-code")))
                .isInstanceOf(SupabaseAdminClient.SupabaseAdminException.class)
                .hasMessageContaining("six-digit email verification code");
    }
}
