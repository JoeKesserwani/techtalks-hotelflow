import { prisma } from '../../../../lib/db';
import { requireAuth } from '../../../../lib/middleware/requireAuth';
import { createUserSchema } from '../../../../lib/validators/user';
import { hashPassword } from '../../../../lib/auth/password';
import { writeAuditLog } from '../../../../lib/services/audit.service';
import { ApiError, handleRouteError } from '../../../../lib/api/errors';

// Never return passwordHash in any response — this shapes every user object we send back.
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

export async function GET() {
  try {
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const users = await prisma.user.findMany({
      where: {
        hotelId: user.hotelId,
        isActive: true,
        role: { not: 'ADMIN' },
      },
      orderBy: { fullName: 'asc' },
    });

    return Response.json(users.map(toSafeUser));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth({ roles: ['ADMIN', 'MANAGER'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);
    const { fullName, email, password, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError('A user with this email already exists', 409);

    const passwordHash = await hashPassword(password);

    const created = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          hotelId: user.hotelId,
          fullName,
          email,
          passwordHash,
          role,
        },
      });

      await writeAuditLog(tx, {
        hotelId: user.hotelId,
        userId: user.userId,
        action: 'USER_CREATED',
        entityType: 'user',
        metadata: { createdUserId: newUser.id, role },
      });

      return newUser;
    });

    return Response.json(toSafeUser(created), { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
