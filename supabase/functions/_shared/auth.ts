import bcrypt from 'npm:bcryptjs@2.4.3';
import { SignJWT, jwtVerify } from 'npm:jose@6';

const TOKEN_TTL = '30d';

export async function hashPassword(password: string): Promise<string> {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compareSync(password, hash);
}

function jwtSecret(): Uint8Array {
  const secret = Deno.env.get('INSTAGRE_JWT_SECRET');
  if (!secret) throw new Error('INSTAGRE_JWT_SECRET is not configured.');
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string, mobile: string): Promise<string> {
  return new SignJWT({ mobile })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(jwtSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; mobile: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    const userId = payload.sub;
    const mobile = payload.mobile;
    if (typeof userId !== 'string' || typeof mobile !== 'string') return null;
    return { userId, mobile };
  } catch {
    return null;
  }
}

export function readUserToken(req: Request): string | null {
  const header = req.headers.get('x-instagre-token');
  return header?.trim() || null;
}
