'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function saveDeliveryPhone(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getSession())?.role !== 'ADMIN') return { ok: false, error: 'Session expirée. Reconnectez-vous.' };
  const raw = String(formData.get('phone') || '').replace(/[\s().-]/g, '');
  const phone = /^0[5-7]\d{8}$/.test(raw) ? `+212${raw.slice(1)}` : raw;
  if (!/^\+212[5-7]\d{8}$/.test(phone)) return { ok: false, error: 'Entrez un numéro marocain valide (ex. 0612345678).' };
  try {
    await prisma.deliverySettings.upsert({
      where: { id: 1 },
      create: { id: 1, phone },
      update: { phone },
    });
    revalidatePath('/inventory');
    return { ok: true };
  } catch (error) {
    console.error('[DELIVERY SETTINGS]', error);
    return { ok: false, error: 'Enregistrement impossible. Réessayez.' };
  }
}
