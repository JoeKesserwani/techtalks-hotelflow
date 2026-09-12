import { prisma } from '../../../../lib/db';
import { requireAuth } from '../../../../lib/middleware/requireAuth';
import { updateHotelSchema } from '../../../../lib/validators/hotel';
import { ApiError, handleRouteError } from '../../../../lib/api/errors';

export async function GET() {
  try {
    const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const hotel = await prisma.hotel.findUnique({ where: { id: user.hotelId } });
    if (!hotel) throw new ApiError('Hotel not found', 404);

    return Response.json(hotel);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth({ roles: ['MANAGER'] });
    if (!user) throw new ApiError('Unauthorized', 401);

    const body = await req.json();
    const parsed = updateHotelSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Invalid request body', 400);

    const updated = await prisma.hotel.update({
      where: { id: user.hotelId },
      data: parsed.data,
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
