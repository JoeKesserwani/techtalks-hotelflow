import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';

export async function GET() {
  try {
    const sessionUser = await requireAuth();
    if (!sessionUser) throw new ApiError('Unauthorized', 401);

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      select: {
        fullName: true,
        role: true,
      },
    });

    if (!user) throw new ApiError('User not found', 404);

    return Response.json({ user });
  } catch (err) {
    return handleRouteError(err);
  }
}
