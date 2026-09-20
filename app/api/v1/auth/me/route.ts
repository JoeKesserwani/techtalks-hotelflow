import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';

export async function GET() {
  try {
    const sessionUser = await requireAuth();
    if (!sessionUser) throw new ApiError('Unauthorized', 401);

    return Response.json({
      user: {
        fullName: sessionUser.fullName,
        role: sessionUser.role,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
