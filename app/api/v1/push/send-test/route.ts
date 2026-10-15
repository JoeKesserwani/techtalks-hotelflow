import { requireAuth } from '../../../../../lib/middleware/requireAuth'
import { sendPushToUser } from '../../../../../lib/push'

export async function POST() {
  const user = await requireAuth({ roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'] })
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  await sendPushToUser(user.userId, 'Test', 'Hello from HotelFlow')
  return Response.json({ ok: true })
}