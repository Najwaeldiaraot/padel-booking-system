import { test, expect } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import { redis } from "../../src/lib/redis";
import { isEncrypted } from "../../src/lib/encryption";

test.describe.serial("08. Authentication Lifecycle, Password Reset & PII Encryption", () => {
  const timestamp = Date.now();
  const testEmail = `player.e2e.${timestamp}@rallypadel.test`;
  const testName = `Rally Player ${timestamp}`;
  const initialPassword = "StrongPassword123!";
  const newPassword = "NewStrongPassword456!";

  let challengeId = "";
  let otpCode = "";
  let sessionCookie = "";

  test("1. Registers new player and retrieves OTP from Redis", async ({ request }) => {
    const regRes = await request.post("/api/auth/register", {
      data: {
        name: testName,
        identifier: testEmail,
        password: initialPassword,
      },
    });

    if (!regRes.ok()) {
      const err = await regRes.json();
      console.error("Register error:", err);
    }

    expect(regRes.ok()).toBeTruthy();
    const regData = await regRes.json();
    expect(regData.success).toBeTruthy();
    expect(regData.challengeId).toBeDefined();
    challengeId = regData.challengeId;

    // Fetch OTP challenge from Redis
    const redisData = await redis.get<{ code: string }>(`otp_reg:${challengeId}`);
    expect(redisData).not.toBeNull();
    expect(redisData?.code).toBeDefined();
    otpCode = redisData!.code;
  });

  test("2. Verifies OTP, establishes session cookie, and checks database PII encryption", async ({ request }) => {
    expect(challengeId).toBeTruthy();
    expect(otpCode).toBeTruthy();

    const verifyRes = await request.post("/api/auth/verify-otp", {
      data: {
        challengeId,
        code: otpCode,
      },
    });

    expect(verifyRes.ok()).toBeTruthy();
    const verifyData = await verifyRes.json();
    expect(verifyData.success).toBeTruthy();
    expect(verifyData.user.name).toBe(testName);
    expect(verifyData.user.email).toBe(testEmail);

    // Extract session cookie
    const setCookieHeader = verifyRes.headers()["set-cookie"];
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain("padel_session");
    sessionCookie = setCookieHeader.split(";")[0];

    // 3. VERIFY DATABASE PII ENCRYPTION DIRECTLY IN POSTGRES/PRISMA
    // A. Verify User Table
    const dbUser = await prisma.user.findFirst({
      where: { email: testEmail },
    });
    expect(dbUser).not.toBeNull();
    // Name must be encrypted AES-256-GCM string (never plain text)
    expect(isEncrypted(dbUser!.name)).toBeTruthy();
    expect(dbUser!.name).not.toBe(testName);
    expect(dbUser!.nameBlindIndex).toBeDefined();
    // Password must be hashed (never plain text)
    expect(dbUser!.passwordHash).not.toBe(initialPassword);
    expect(dbUser!.passwordHash).toContain(":");

    // B. Verify Customer Table Sync
    const dbCustomer = await prisma.customer.findFirst({
      where: { emailBlindIndex: dbUser!.emailBlindIndex },
    });
    expect(dbCustomer).not.toBeNull();
    // Customer name and email must be strictly encrypted
    expect(isEncrypted(dbCustomer!.name)).toBeTruthy();
    expect(dbCustomer!.name).not.toBe(testName);
    if (dbCustomer!.email) {
      expect(isEncrypted(dbCustomer!.email)).toBeTruthy();
      expect(dbCustomer!.email).not.toBe(testEmail);
    }
  });

  test("3. Logs in with player credentials across devices and retrieves enriched metrics", async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: {
        identifier: testEmail,
        password: initialPassword,
      },
    });

    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    expect(loginData.success).toBeTruthy();
    expect(loginData.user.name).toBe(testName);
    expect(loginData.user.totalBookings).toBeDefined();
    expect(loginData.user.daysSinceLastVisit).toBeDefined();
    expect(loginData.user.loyaltyTier).toBeDefined();
  });

  test("4. Resets password via OTP flow and verifies new credentials", async ({ request }) => {
    // A. Request password reset OTP
    const forgotRes = await request.post("/api/auth/forgot-password", {
      data: { identifier: testEmail },
    });
    expect(forgotRes.ok()).toBeTruthy();
    const forgotData = await forgotRes.json();
    expect(forgotData.success).toBeTruthy();
    const resetChallengeId = forgotData.challengeId;

    // Retrieve reset OTP from Redis
    const resetRedisData = await redis.get<{ code: string }>(`otp_reset:${resetChallengeId}`);
    expect(resetRedisData).not.toBeNull();
    const resetCode = resetRedisData!.code;

    // B. Submit new password
    const resetRes = await request.post("/api/auth/reset-password", {
      data: {
        challengeId: resetChallengeId,
        code: resetCode,
        newPassword: newPassword,
      },
    });
    expect(resetRes.ok()).toBeTruthy();
    const resetResult = await resetRes.json();
    expect(resetResult.success).toBeTruthy();

    // C. Verify old password is rejected
    const oldLoginRes = await request.post("/api/auth/login", {
      data: {
        identifier: testEmail,
        password: initialPassword,
      },
    });
    expect(oldLoginRes.status()).toBe(401);

    // D. Verify new password is accepted
    const newLoginRes = await request.post("/api/auth/login", {
      data: {
        identifier: testEmail,
        password: newPassword,
      },
    });
    expect(newLoginRes.ok()).toBeTruthy();
  });

  test("5. Verifies safe decryption on Admin Customers API", async ({ request }) => {
    const customersRes = await request.get(`/api/admin/customers?search=${encodeURIComponent(testName)}`);
    expect(customersRes.ok()).toBeTruthy();
    const customers = await customersRes.json();

    const matchingCustomer = customers.find((c: any) => c.name === testName);
    expect(matchingCustomer).toBeDefined();
    // In API response, name and email must be safely decrypted for authorized admin
    expect(matchingCustomer.name).toBe(testName);
    expect(matchingCustomer.email).toBe(testEmail);
  });
});
