import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_PATH = path.join(LOG_DIR, "auth.email-otp.log");

function maskEmail(email: string): string {
  const [localPart = "", domain = "unknown"] = email.split("@");
  const firstChar = localPart.slice(0, 1) || "*";
  return `${firstChar}***@${domain}`;
}

export async function logEmailOtpEvent(params: {
  event: "email_otp.delivery_queued" | "email_otp.delivery_sent" | "email_otp.delivery_failed";
  message: string;
  email: string;
  otpType: string;
  durationMs?: number;
  errorMessage?: string | null;
}) {
  const { event, message, email, otpType, durationMs, errorMessage } = params;
  await mkdir(LOG_DIR, { recursive: true });

  const fields = [
    `ts=${new Date().toISOString()}`,
    "module=auth.email-otp",
    `event=${event}`,
    `message="${message}"`,
    `email_hint=${maskEmail(email)}`,
    `otp_type=${otpType}`,
  ];

  if (typeof durationMs === "number") {
    fields.push(`duration_ms=${durationMs}`);
  }

  if (errorMessage) {
    fields.push(`error_message="${errorMessage.replaceAll('"', "'")}"`);
  }

  await appendFile(LOG_PATH, `${fields.join(" ")}\n`, "utf8");
}
