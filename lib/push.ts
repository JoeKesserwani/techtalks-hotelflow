import webpush from 'web-push'
import { prisma } from '@/lib/db'

let warnedAboutMissingVapidConfiguration = false

export async function sendPushToUser(userId: string, title: string, body: string) {
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } })
    if (subs.length === 0) return

    const subject = process.env.VAPID_SUBJECT
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!subject || !publicKey || !privateKey) {
      if (!warnedAboutMissingVapidConfiguration) {
        console.warn(
          'Push notifications are disabled; configure VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY.'
        )
        warnedAboutMissingVapidConfiguration = true
      }
      return
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title, body, url: '/' })
          )
        } catch (err) {
          const statusCode =
            err && typeof err === 'object' && 'statusCode' in err
              ? err.statusCode
              : undefined

          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } })
          } else {
            console.error('Push notification delivery failed', err)
          }
        }
      })
    )
  } catch (err) {
    console.error('Push failed', err)
  }
}