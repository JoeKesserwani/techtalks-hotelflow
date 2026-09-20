import { prisma } from '../../../../lib/db';
import { requireAuth } from '../../../../lib/middleware/requireAuth';
import { ApiError, handleRouteError } from '../../../../lib/api/errors';

export async function GET(req: Request) {
  try {
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const url = new URL(req.url);
    const entityType = url.searchParams.get('entityType') ?? undefined;
    const action = url.searchParams.get('action') ?? undefined;
    const limitParam = Number(url.searchParams.get('limit') ?? '100');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;

    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { fullName: true } } },
      where: {
        hotelId: user.hotelId,
        ...(entityType ? { entityType } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return Response.json(logs);
  } catch (err) {
    return handleRouteError(err);
  }
}