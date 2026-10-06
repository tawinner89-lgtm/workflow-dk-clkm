import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') || '';
    const expectedToken = process.env.WEBHOOK_SECRET;
    
    if (!expectedToken) {
        return NextResponse.json({ success: false, error: 'Serveur mal configurǸ (WEBHOOK_SECRET manquant)' }, { status: 500 });
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', expectedToken)
      .update(rawBody)
      .digest('hex');
    
    if (
      !signature ||
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return NextResponse.json({ success: false, error: 'Signature HMAC invalide' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    
    const { 
      clientName, 
      clientAddress, 
      clientContactPhone, 
      problemReported, 
      type,
      technicianName,
      proposedTime,
      reference: providedReference
    } = body;

    // Validate required fields
    if (!clientName || !clientAddress) {
      return NextResponse.json({ success: false, error: 'Nom et adresse du client obligatoires' }, { status: 400 });
    }

    if (providedReference) {
      const existing = await prisma.intervention.findUnique({
        where: { reference: providedReference }
      });
      if (existing) {
        const intervention = await prisma.intervention.update({
          where: { reference: providedReference },
          data: {
            clientName: String(clientName).trim(),
            clientAddress: String(clientAddress).trim(),
            clientContactPhone: clientContactPhone ? String(clientContactPhone).trim() : '',
            problemReported: problemReported ? String(problemReported).trim() : '',
            type: type ? String(type).trim() : 'Maintenance',
            startTime: proposedTime ? String(proposedTime).trim() : existing.startTime
          }
        });
        return NextResponse.json({ success: true, data: intervention, updated: true });
      }
    }

    // Generate Reference: INT-YYYYMMDD-RANDOM (e.g., INT-20260826-A1B2)
    const date = new Date();
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const reference = `INT-${dateString}-${randomStr}`;

    // Create the intervention
    const intervention = await prisma.intervention.create({
      data: {
        reference,
        clientName: String(clientName).trim(),
        clientAddress: String(clientAddress).trim(),
        clientContactPhone: clientContactPhone ? String(clientContactPhone).trim() : '',
        problemReported: problemReported ? String(problemReported).trim() : '',
        type: type ? String(type).trim() : 'Maintenance',
        technicianName: technicianName ? String(technicianName).trim() : '? assigner (Bot)',
        status: 'PLANIFIEE',
        startTime: proposedTime ? String(proposedTime).trim() : null
      }
    });

    return NextResponse.json({ success: true, data: intervention });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur inconnue";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
