import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { verifyPassword } from "../../../../../lib/auth/password";
import { signAccessToken } from "../../../../../lib/auth/jwt";
import { createSession } from "../../../../../lib/auth/session";
import { ApiError, handleRouteError } from "../../../../../lib/api/errors";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("Invalid request body", 400);
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new ApiError("Invalid credentials", 401);
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      throw new ApiError("Invalid credentials", 401);
    }

    const accessToken = signAccessToken({
      userId: user.id,
      hotelId: user.hotelId,
      role: user.role,
    });
    const { rawToken: refreshToken, expiresAt } = await createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 15 * 60,
    });
    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: expiresAt,
    });

    return Response.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        hotelId: user.hotelId,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
