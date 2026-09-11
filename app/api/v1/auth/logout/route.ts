import { cookies } from 'next/headers';
import { revokeSession } from '../../../../../lib/auth/session';
import { handleRouteError } from '../../../../../lib/api/errors';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (refreshToken) {
      await revokeSession(refreshToken);
    }

    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');

    return Response.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
