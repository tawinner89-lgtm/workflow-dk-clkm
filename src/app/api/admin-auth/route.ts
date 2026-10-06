import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD || 'dkclim2026';
    
    if (typeof password === 'string' && password.length === correctPassword.length) {
      if (crypto.timingSafeEqual(Buffer.from(password), Buffer.from(correctPassword))) {
        await createSession({ role: 'ADMIN' });
        return NextResponse.json({ success: true });
      }
    }
    
    return NextResponse.json({ success: false, error: 'Mot de passe incorrect' }, { status: 401 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
