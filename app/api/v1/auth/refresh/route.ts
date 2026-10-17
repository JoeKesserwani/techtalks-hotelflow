import { cookies } from "next/headers";
import { prisma } from "../../../../../lib/db";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
} from "../../../../../lib/auth/jwt";
import { rotateSession } from "../../../../../lib/auth/session";
import { ApiError, handleRouteError } from "../../../../../lib/api/errors";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      throw new ApiError("No refresh token", 401);
    }

    const rotated = await rotateSession(refreshToken);
    if (!rotated) {
      throw new ApiError("Invalid or expired session", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: rotated.userId },
    });
    if (!user || !user.isActive) {
      throw new ApiError("User no longer active", 401);
    }

    const accessToken = signAccessToken({
      userId: user.id,
      hotelId: user.hotelId,
      role: user.role,
      fullName: user.fullName,
    });

    cookieStore.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
    cookieStore.set("refresh_token", rotated.rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: rotated.expiresAt,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
