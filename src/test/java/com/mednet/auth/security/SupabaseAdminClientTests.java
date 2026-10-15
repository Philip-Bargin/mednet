package com.mednet.auth.security;

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
}
