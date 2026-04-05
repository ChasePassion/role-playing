import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, jwt } from "better-auth/plugins";
import nodemailer from "nodemailer";
import { Pool } from "pg";

import { logEmailOtpEvent } from "./auth-email-otp-log";

const databaseUrl = process.env.DATABASE_URL;
const betterAuthUrl = process.env.BETTER_AUTH_URL;
const betterAuthSecret = process.env.BETTER_AUTH_SECRET;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL for Better Auth.");
}

if (!betterAuthUrl) {
  throw new Error("Missing BETTER_AUTH_URL for Better Auth.");
}

if (!betterAuthSecret) {
  throw new Error("Missing BETTER_AUTH_SECRET for Better Auth.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

type EmailOtpDeliveryType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";
type EmailOtpDeliveryStatus = "queued" | "sent" | "failed";

let emailTransporter: nodemailer.Transporter | null = null;
let ensureEmailOtpDeliveryStatusTablePromise: Promise<void> | null = null;

function getPurelymailConfig() {
  const host = process.env.PURELYMAIL_SMTP_HOST?.trim() || "smtp.purelymail.com";
  const port = Number(process.env.PURELYMAIL_SMTP_PORT || "465");
  const user = process.env.PURELYMAIL_SMTP_USER?.trim();
  const password = process.env.PURELYMAIL_SMTP_PASSWORD?.trim();
  const from = process.env.PURELYMAIL_FROM_EMAIL?.trim();

  if (!user) {
    throw new Error("Missing PURELYMAIL_SMTP_USER for Better Auth email OTP.");
  }

  if (!password) {
    throw new Error("Missing PURELYMAIL_SMTP_PASSWORD for Better Auth email OTP.");
  }

  if (!from) {
    throw new Error("Missing PURELYMAIL_FROM_EMAIL for Better Auth email OTP.");
  }

  return {
    host,
    port,
    secure: port === 465,
    user,
    password,
    from,
  };
}

function getPurelymailTransporter() {
  if (emailTransporter) {
    return emailTransporter;
  }

  const config = getPurelymailConfig();

  emailTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  return emailTransporter;
}

async function ensureEmailOtpDeliveryStatusTable(): Promise<void> {
  if (!ensureEmailOtpDeliveryStatusTablePromise) {
    ensureEmailOtpDeliveryStatusTablePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS email_otp_delivery_status (
          email TEXT NOT NULL,
          otp_type TEXT NOT NULL,
          status TEXT NOT NULL,
          error_message TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (email, otp_type)
        )
      `)
      .then(() => undefined);
  }

  await ensureEmailOtpDeliveryStatusTablePromise;
}

async function updateEmailOtpDeliveryStatus(
  email: string,
  type: EmailOtpDeliveryType,
  status: EmailOtpDeliveryStatus,
  errorMessage: string | null = null,
): Promise<void> {
  await ensureEmailOtpDeliveryStatusTable();
  await pool.query(
    `
      INSERT INTO email_otp_delivery_status (
        email,
        otp_type,
        status,
        error_message,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (email, otp_type)
      DO UPDATE SET
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        updated_at = NOW()
    `,
    [email, type, status, errorMessage],
  );
}

function normalizeDeliveryError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "邮件发送失败，请稍后重试";
  }

  const message = error.message.trim();
  return message || "邮件发送失败，请稍后重试";
}

async function persistEmailOtpDeliveryStatus(params: {
  email: string;
  type: EmailOtpDeliveryType;
  status: EmailOtpDeliveryStatus;
  errorMessage?: string | null;
}) {
  const { email, type, status, errorMessage = null } = params;

  try {
    await updateEmailOtpDeliveryStatus(email, type, status, errorMessage);
  } catch (error) {
    console.error("Failed to persist OTP delivery status:", error);
  }
}

async function writeEmailOtpDeliveryLog(params: Parameters<typeof logEmailOtpEvent>[0]) {
  try {
    await logEmailOtpEvent(params);
  } catch (error) {
    console.error("Failed to write OTP delivery log:", error);
  }
}

function queueEmailOtpDelivery(params: {
  email: string;
  type: EmailOtpDeliveryType;
  subject: string;
  html: string;
}) {
  const { email, type, subject, html } = params;
  const config = getPurelymailConfig();
  const transporter = getPurelymailTransporter();
  const startedAt = Date.now();

  setTimeout(() => {
    void (async () => {
      try {
        await transporter.sendMail({
          from: config.from,
          to: email,
          subject,
          html,
        });

        await persistEmailOtpDeliveryStatus({
          email,
          type,
          status: "sent",
        });
        await writeEmailOtpDeliveryLog({
          event: "email_otp.delivery_sent",
          message: "OTP email delivered to SMTP provider",
          email,
          otpType: type,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        const normalizedError = normalizeDeliveryError(error);
        console.error("Failed to deliver OTP email:", normalizedError);
        await persistEmailOtpDeliveryStatus({
          email,
          type,
          status: "failed",
          errorMessage: normalizedError,
        });
        await writeEmailOtpDeliveryLog({
          event: "email_otp.delivery_failed",
          message: "OTP email delivery failed",
          email,
          otpType: type,
          durationMs: Date.now() - startedAt,
          errorMessage: normalizedError,
        });
      }
    })();
  }, 0);
}

export async function getEmailOtpDeliveryStatus(
  email: string,
  type: EmailOtpDeliveryType,
): Promise<{
  status: EmailOtpDeliveryStatus | "idle";
  errorMessage: string | null;
}> {
  await ensureEmailOtpDeliveryStatusTable();
  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query<{
    status: EmailOtpDeliveryStatus;
    error_message: string | null;
  }>(
    `
      SELECT status, error_message
      FROM email_otp_delivery_status
      WHERE email = $1 AND otp_type = $2
    `,
    [normalizedEmail, type],
  );

  const row = result.rows[0];
  if (!row) {
    return {
      status: "idle",
      errorMessage: null,
    };
  }

  return {
    status: row.status,
    errorMessage: row.error_message,
  };
}

function buildGoogleProvider() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return {
    google: {
      clientId,
      clientSecret,
    },
  };
}

export const auth = betterAuth({
  appName: "NeuraChar",
  database: pool,
  baseURL: betterAuthUrl,
  trustedOrigins: [betterAuthUrl],
  secret: betterAuthSecret,
  user: {
    modelName: "users",
    fields: {
      name: "display_name",
      image: "avatar_url",
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: false,
        fieldName: "username",
      },
      lastLoginAt: {
        type: "date",
        required: false,
        input: false,
        fieldName: "last_login_at",
      },
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: buildGoogleProvider(),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const fallbackName =
            user.name?.trim() || user.email.split("@")[0] || "新用户";
          return {
            data: {
              ...user,
              name: fallbackName,
            },
          };
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await pool.query(
            "UPDATE users SET last_login_at = NOW() WHERE id = $1",
            [session.userId],
          );
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        const normalizedEmail = email.trim().toLowerCase();
        getPurelymailConfig();
        getPurelymailTransporter();

        const subject =
          type === "forget-password"
            ? "ParlaSoul 密码重置验证码"
            : type === "email-verification"
              ? "ParlaSoul 邮箱验证验证码"
              : "ParlaSoul 登录验证码";

        const title =
          type === "forget-password"
            ? "密码重置验证码"
            : type === "email-verification"
              ? "邮箱验证验证码"
              : "登录验证码";

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
            <h2 style="margin-bottom: 12px;">${title}</h2>
            <p>您好，您的验证码如下：</p>
            <div style="margin: 20px 0; font-size: 28px; font-weight: 700; letter-spacing: 8px;">${otp}</div>
            <p>验证码 5 分钟内有效，请勿泄露给他人。</p>
          </div>
        `;

        await updateEmailOtpDeliveryStatus(normalizedEmail, type, "queued");
        await writeEmailOtpDeliveryLog({
          event: "email_otp.delivery_queued",
          message: "OTP email queued for background delivery",
          email: normalizedEmail,
          otpType: type,
        });
        queueEmailOtpDelivery({
          email: normalizedEmail,
          type,
          subject,
          html,
        });
      },
    }),
    jwt(),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
