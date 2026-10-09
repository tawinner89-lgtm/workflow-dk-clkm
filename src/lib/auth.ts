import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  return new TextEncoder().encode(secret || 'dkclim-local-development-only');
}

export type SessionPayload = 
  | { role: 'ADMIN' }
  | { role: 'TECHNICIAN'; id: string; name: string };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
    
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
    const verified = await jwtVerify(token, getJwtSecret());
    return verified.payload as SessionPayload;
  } catch {
    return null;
  }
}

export function clearSession() {
  cookies().delete('auth_session');
}

