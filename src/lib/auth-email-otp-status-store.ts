import { createHash } from "node:crypto";

import { getRedisClient } from "./redis";

export type EmailOtpDeliveryType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";
export type EmailOtpDeliveryStatus = "queued" | "sent" | "failed";

type PersistedEmailOtpDeliveryStatus = {
  status: EmailOtpDeliveryStatus;
  updatedAt: string;
  errorMessage: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getEmailOtpStatusKeyPrefix(): string {
  const prefix = process.env.OTP_DELIVERY_STATUS_KEY_PREFIX?.trim();
  return prefix || "auth:email-otp:status";
}

function getEmailOtpStatusTtlSeconds(): number {
  const rawValue = process.env.OTP_DELIVERY_STATUS_TTL_SECONDS?.trim();
  if (!rawValue) {
    return 600;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("OTP_DELIVERY_STATUS_TTL_SECONDS must be a positive integer.");
  }

  return parsed;
}

function buildEmailOtpStatusKey(email: string, type: EmailOtpDeliveryType): string {
  const digest = createHash("sha256")
    .update(`${type}:${normalizeEmail(email)}`)
    .digest("hex");
  return `${getEmailOtpStatusKeyPrefix()}:${type}:${digest}`;
}

async function setEmailOtpDeliveryStatus(params: {
  email: string;
  type: EmailOtpDeliveryType;
  status: EmailOtpDeliveryStatus;
  errorMessage?: string | null;
}) {
  const { email, type, status, errorMessage = null } = params;
  const client = await getRedisClient();
  const key = buildEmailOtpStatusKey(email, type);

  const payload: PersistedEmailOtpDeliveryStatus = {
    status,
    updatedAt: new Date().toISOString(),
    errorMessage,
  };

  await client.set(key, JSON.stringify(payload), {
    EX: getEmailOtpStatusTtlSeconds(),
  });
}

export async function setEmailOtpDeliveryQueued(
  email: string,
  type: EmailOtpDeliveryType,
) {
  await setEmailOtpDeliveryStatus({
    email,
    type,
    status: "queued",
  });
}

export async function setEmailOtpDeliverySent(
  email: string,
  type: EmailOtpDeliveryType,
) {
  await setEmailOtpDeliveryStatus({
    email,
    type,
    status: "sent",
  });
}

export async function setEmailOtpDeliveryFailed(
  email: string,
  type: EmailOtpDeliveryType,
  errorMessage: string | null,
) {
  await setEmailOtpDeliveryStatus({
    email,
    type,
    status: "failed",
    errorMessage,
  });
}

export async function getEmailOtpDeliveryStatus(
  email: string,
  type: EmailOtpDeliveryType,
): Promise<{
  status: EmailOtpDeliveryStatus | "idle";
  errorMessage: string | null;
}> {
  const client = await getRedisClient();
  const key = buildEmailOtpStatusKey(email, type);
  const rawValue = await client.get(key);

  if (!rawValue) {
    return {
      status: "idle",
      errorMessage: null,
    };
  }

  try {
    const payload = JSON.parse(rawValue) as PersistedEmailOtpDeliveryStatus;
    if (
      payload.status !== "queued" &&
      payload.status !== "sent" &&
      payload.status !== "failed"
    ) {
      throw new Error("Invalid cached OTP delivery status.");
    }

    return {
      status: payload.status,
      errorMessage:
        typeof payload.errorMessage === "string" ? payload.errorMessage : null,
    };
  } catch (error) {
    console.error("Failed to parse cached OTP delivery status:", error);
    await client.del(key);
    return {
      status: "idle",
      errorMessage: null,
    };
  }
}
