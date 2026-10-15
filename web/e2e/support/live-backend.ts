import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Helpers for `*.live.spec.ts`, which run against a real MedNet API with a disposable database.
 *
 * Email delivery is switched off in local runs, so the emailed verification link and reset code
 * never arrive. `deliverEmailToken` stands in for the inbox only: it stores a known token the same
 * way `AuthTokenService` does (SHA-256, base64url, no padding), and the real `/auth/verify` and
 * `/auth/reset-password/*` endpoints then do all of the checking.
 *
 * Two disposable databases are supported: the H2 file database started for these runs
 * (`MEDNET_LIVE_H2_URL` + `MEDNET_LIVE_H2_JAR`), or a PostgreSQL test database whose name ends in
 * `_test` (`MEDNET_LIVE_PG_URL` as a JDBC URL, `MEDNET_LIVE_PG_USER`, `MEDNET_LIVE_PG_PASSWORD`, and
 * optionally `MEDNET_LIVE_PSQL` for the psql path). Never point this at a shared or production database.
 */
const h2Url = process.env.MEDNET_LIVE_H2_URL;
const h2Jar = process.env.MEDNET_LIVE_H2_JAR;
const pgUrl = process.env.MEDNET_LIVE_PG_URL;
const pgUser = process.env.MEDNET_LIVE_PG_USER;
const pgPassword = process.env.MEDNET_LIVE_PG_PASSWORD;
const usePostgres = Boolean(pgUrl && pgUser && pgPassword);

export const canDeliverEmailTokens = Boolean(h2Url && h2Jar) || usePostgres;

export const liveAdmin = {
  email: process.env.MEDNET_LIVE_ADMIN_EMAIL ?? "",
  password: process.env.MEDNET_LIVE_ADMIN_PASSWORD ?? "",
};

export function tokenHash(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("base64url");
}

function runSql(sql: string) {
  if (usePostgres) return runPostgresSql(sql);
  if (!h2Url || !h2Jar) throw new Error("MEDNET_LIVE_H2_URL and MEDNET_LIVE_H2_JAR are required");
  if (!h2Url.startsWith("jdbc:h2:")) throw new Error("Only a disposable H2 database is supported");
  execFileSync("java", ["-cp", h2Jar, "org.h2.tools.Shell", "-url", h2Url, "-user", "sa", "-password", "", "-sql", sql], {
    stdio: "pipe",
  });
}

function runPostgresSql(sql: string) {
  const match = /^jdbc:(postgresql:\/\/[^/?]+\/([A-Za-z0-9_]+)(\?.*)?)$/.exec(pgUrl ?? "");
  if (!match) throw new Error("MEDNET_LIVE_PG_URL must be a jdbc:postgresql://host:port/database URL");
  if (!match[2].endsWith("_test")) throw new Error("Only a disposable PostgreSQL database whose name ends in _test is supported");
  // The password travels in the child's environment, never on the command line.
  execFileSync(process.env.MEDNET_LIVE_PSQL ?? "psql", ["-X", "-w", "-q", "-v", "ON_ERROR_STOP=1", "-U", pgUser!, "-d", match[1], "-c", sql], {
    stdio: "pipe",
    env: { ...process.env, PGPASSWORD: pgPassword },
  });
}

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

const inFuture = (amount: number, unit: "HOUR" | "MINUTE") =>
  usePostgres ? `CURRENT_TIMESTAMP + INTERVAL '${amount} ${unit}'` : `DATEADD('${unit}', ${amount}, CURRENT_TIMESTAMP)`;

/** Simulates opening the verification email: returns a raw link token the API will accept. */
export function deliverVerificationToken(email: string): string {
  const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  runSql(
    `UPDATE platform_accounts SET verification_token_hash = ${sqlString(tokenHash(raw))}, ` +
      `verification_token_expires_at = ${inFuture(1, "HOUR")} WHERE email = ${sqlString(email)}`,
  );
  return raw;
}

/** Simulates receiving the six-digit password reset email. */
export function deliverResetCode(email: string, code: string) {
  runSql(
    `UPDATE platform_accounts SET password_reset_token_hash = ${sqlString(tokenHash(`password-reset-otp:${code}`))}, ` +
      `password_reset_token_expires_at = ${inFuture(10, "MINUTE")}, ` +
      `password_reset_verified = FALSE, password_reset_attempts = 0 WHERE email = ${sqlString(email)}`,
  );
}
