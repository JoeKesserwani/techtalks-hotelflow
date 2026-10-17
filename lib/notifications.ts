import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_APPROVED"
  | "TASK_REJECTED"
  | "TASK_SUBMITTED"
  | "RESERVATION_CREATED";

type CreateNotificationInput = {
  hotelId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  taskId?: string;
};

export async function createNotification(
  data: CreateNotificationInput,
  tx?: Pick<typeof prisma, "$executeRaw">,
) {
  const client = tx ?? prisma;

  if (typeof client.$executeRaw !== "function") {
    throw new Error("Notification client is unavailable");
  }

  await client.$executeRaw`
    INSERT INTO notifications (
      id,
      hotel_id,
      user_id,
      title,
      message,
      type,
      task_id,
      is_read,
      created_at
    )
    VALUES (
      UUID(),
      ${data.hotelId},
      ${data.userId},
      ${data.title},
      ${data.message},
      ${data.type},
      ${data.taskId ?? null},
      false,
      NOW()
    )
  `;

  await sendPushToUser(data.userId, data.title, data.message);
}

export async function notifyRoles(
  hotelId: string,
  roles: ("ADMIN" | "MANAGER" | "RECEPTIONIST" | "HOUSEKEEPING")[],
  data: Omit<CreateNotificationInput, "hotelId" | "userId">,
) {
  const users = await prisma.user.findMany({
    where: { hotelId, role: { in: roles }, isActive: true },
    select: { id: true },
  });

  await Promise.all(
    users.map((u) => createNotification({ ...data, hotelId, userId: u.id })),
  );
}