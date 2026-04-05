import { NextRequest, NextResponse } from "next/server";

import {
  getEmailOtpDeliveryStatus,
  type EmailOtpDeliveryType,
} from "@/lib/auth-email-otp-status-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const type =
    (request.nextUrl.searchParams.get("type") as
      | EmailOtpDeliveryType
      | null) ?? "sign-in";

  if (!email) {
    return NextResponse.json(
      {
        status: "failed",
        errorMessage: "缺少邮箱参数",
      },
      { status: 400 },
    );
  }

  const result = await getEmailOtpDeliveryStatus(email, type);
  return NextResponse.json(result);
}
