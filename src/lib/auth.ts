import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretStr = process.env.JWT_SECRET || 'dkclim-dev-secret-fallback';
const JWT_SECRET = new TextEncoder().encode(secretStr);

export type SessionPayload = 
  | { role: 'ADMIN' }
  | { role: 'TECHNICIAN'; id: string; name: string };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
    
  cookies().set('auth_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get('auth_session')?.value;
  if (!token) return null;
  
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as SessionPayload;
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete('auth_session');
}

