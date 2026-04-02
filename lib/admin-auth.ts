import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "buyselleric_admin";

export function sealAdminSession(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = String(exp);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminSession(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  const [payload, sig] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (sig.length !== expected.length) {
    return false;
  }
  try {
    const ok = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    const exp = Number.parseInt(payload, 10);
    return ok && !Number.isNaN(exp) && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return false;
  }
  const a = createHash("sha256").update(password, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
