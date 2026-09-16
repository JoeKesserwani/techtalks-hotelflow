import { cookies } from 'next/headers';
import { verifyAccessToken, AccessTokenPayload } from '../auth/jwt';

export type Role = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING';

/**
 * Verifies the access token cookie and (optionally) checks the caller's role.
 * Returns the decoded token payload (userId, hotelId, role) or null if unauthorized.
 *
 * Usage inside a route handler:
 *   const user = await requireAuth({ roles: ['MANAGER', 'RECEPTIONIST'] });
 *   if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function requireAuth(options?: { roles?: Role[] }): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  if (options?.roles && !options.roles.includes(payload.role)) {
    return null;
  }

  return payload;
}
