import { NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD;
    if (!correctPassword) {
      return NextResponse.json({ success: false, error: 'ADMIN_PASSWORD is not configured.' }, { status: 503 });
    }
    
    const submitted = typeof password === 'string' ? Buffer.from(password) : Buffer.alloc(0);
    const expected = Buffer.from(correctPassword);
    if (submitted.length === expected.length && submitted.length > 0) {
      if (crypto.timingSafeEqual(submitted, expected)) {
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

