package com.mednet;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.test.context.DynamicPropertyRegistry;

/**
 * Connects the PostgreSQL integration tests to the dedicated test database named by
 * {@code MEDNET_TEST_DATABASE_URL}, {@code MEDNET_TEST_DATABASE_USERNAME} and
 * {@code MEDNET_TEST_DATABASE_PASSWORD}.
 *
 * <p>Each test run starts from an empty schema: once per JVM, the {@code public} schema of the test
 * database is dropped and recreated so Flyway migrates from scratch. The reset is confined to that one
 * database; it does not touch other databases or the role's privileges elsewhere. To keep that reset away from data that matters, the run is
 * refused unless the database name ends in {@code _test}, the role is not a superuser and the role owns
 * the database.
 */
final class PostgreSqlTestDatabase {

    private static final AtomicBoolean RESET = new AtomicBoolean();

    private PostgreSqlTestDatabase() {
    }

    static void register(DynamicPropertyRegistry registry) {
        String url = requiredSetting("MEDNET_TEST_DATABASE_URL");
        String username = requiredSetting("MEDNET_TEST_DATABASE_USERNAME");
        String password = requiredSetting("MEDNET_TEST_DATABASE_PASSWORD");
        if (!url.startsWith("jdbc:postgresql:")) {
            throw new IllegalStateException("MEDNET_TEST_DATABASE_URL must be a jdbc:postgresql: URL");
        }
        if (RESET.compareAndSet(false, true)) {
            reset(url, username, password);
        }
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> username);
        registry.add("spring.datasource.password", () -> password);
    }

    private static void reset(String url, String username, String password) {
        try (Connection connection = DriverManager.getConnection(url, username, password);
                Statement statement = connection.createStatement()) {
            try (ResultSet target = statement.executeQuery("""
                    SELECT current_database(),
                           (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),
                           pg_get_userbyid(datdba) = current_user
                    FROM pg_database
                    WHERE datname = current_database()
                    """)) {
                target.next();
                String database = target.getString(1);
                if (!database.endsWith("_test")) {
                    throw new IllegalStateException("Refusing to reset database '" + database
                            + "': the PostgreSQL test database name must end in _test");
                }
                if (target.getBoolean(2)) {
                    throw new IllegalStateException("Refusing to reset database '" + database
                            + "': MEDNET_TEST_DATABASE_USERNAME must not be a superuser");
                }
                if (!target.getBoolean(3)) {
                    throw new IllegalStateException("Refusing to reset database '" + database
                            + "': MEDNET_TEST_DATABASE_USERNAME must own the test database");
                }
            }
            statement.execute("DROP SCHEMA IF EXISTS public CASCADE");
            statement.execute("CREATE SCHEMA public");
        } catch (SQLException exception) {
            throw new IllegalStateException("Cannot prepare the PostgreSQL test database as MEDNET_TEST_DATABASE_USERNAME "
                    + "(SQL state " + exception.getSQLState() + "): " + exception.getMessage(), exception);
        }
    }

    private static String requiredSetting(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " must point to a dedicated PostgreSQL test database");
        }
        return value;
    }
}
