import { prisma } from '../../../../../lib/db'
import { requireAuth } from '../../../../../lib/middleware/requireAuth'
import { ApiError, handleRouteError } from '../../../../../lib/api/errors'

export async function POST(req: Request) {
  try {
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'] })
    if (!user) throw new ApiError('Unauthorized', 401)

    const sub = await req.json()
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { userId: user.userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      create: { userId: user.userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    })
    return Response.json({ ok: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
