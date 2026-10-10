import webpush from 'web-push'
import { prisma } from '@/lib/db'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToUser(userId: string, title: string, body: string) {
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } })
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title, body, url: '/' })
          )
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } })
          }
        }
      })
    )
  } catch (err) {
    console.error('Push failed', err)
  }
}