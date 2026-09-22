import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN = '15m';

export type AccessTokenPayload = {
  userId: string;
  hotelId: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING';
  fullName: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
