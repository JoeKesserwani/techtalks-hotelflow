import webpush from 'web-push'
import { prisma } from '@/lib/db'

const subject = process.env.VAPID_SUBJECT
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const vapidConfig =
  subject && publicKey && privateKey
    ? { subject, publicKey, privateKey }
    : null
let vapidConfigured = false

if (!vapidConfig) {
  console.warn(
    'Web push is disabled: set VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY to enable it.'
  )
}

export async function sendPushToUser(userId: string, title: string, body: string) {
  if (!vapidConfig) return

  try {
    if (!vapidConfigured) {
      webpush.setVapidDetails(
        vapidConfig.subject,
        vapidConfig.publicKey,
        vapidConfig.privateKey
      )
      vapidConfigured = true
    }

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