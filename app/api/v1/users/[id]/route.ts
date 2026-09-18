import { prisma } from '../../../../../lib/db';
import { requireAuth } from '../../../../../lib/middleware/requireAuth';
import { updateUserSchema } from '../../../../../lib/validators/user';
import { hashPassword } from '../../../../../lib/auth/password';
import { writeAuditLog } from '../../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../../lib/api/errors';

function toSafeUser(user: {
  id: string;
  hotelId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { id, hotelId, fullName, email, role, isActive, createdAt, updatedAt } = user;
  return { id, hotelId, fullName, email, role, isActive, createdAt, updatedAt };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const target = await prisma.user.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!target) throw new ApiError('User not found', 404);

    return Response.json(toSafeUser(target));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);

    const target = await prisma.user.findFirst({ where: { id, hotelId: user.hotelId } });
    if (!target) throw new ApiError('User not found', 404);

    if (parsed.data.email && parsed.data.email !== target.email) {
      const userWithEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (userWithEmail) throw new ApiError('A user with this email already exists', 409);
    }

    const { password, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await hashPassword(password);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({ where: { id }, data });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'USER_UPDATED',
        entityType: 'user',
        metadata: { targetUserId: id, changes: Object.keys(parsed.data) },
      });

      return result;
    });

    return Response.json(toSafeUser(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}
