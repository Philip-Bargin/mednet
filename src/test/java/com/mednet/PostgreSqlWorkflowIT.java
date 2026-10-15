package com.mednet;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Runs every API workflow test in {@link MedNetApplicationTests} against the dedicated PostgreSQL
 * test database instead of H2. Dynamic properties take precedence over the H2 datasource declared on
 * the parent class.
 */
class PostgreSqlWorkflowIT extends MedNetApplicationTests {

    @DynamicPropertySource
    static void usePostgreSqlTestDatabase(DynamicPropertyRegistry registry) {
        PostgreSqlTestDatabase.register(registry);
    }
}
