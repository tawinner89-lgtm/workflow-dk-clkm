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
      intent,
      symptom,
      ac_type,
      units,
      brand,
      btu,
      budget,
      room_area,
      day,
      time_window,
      technicianName,
      proposedTime,
      reference: providedReference,
      syncHash
    } = body;

    // Validate required fields
    if (!clientName || !clientAddress) {
      return NextResponse.json({ success: false, error: 'Nom et adresse du client obligatoires' }, { status: 400 });
    }

    const existing = providedReference
      ? await prisma.intervention.findUnique({ where: { reference: providedReference } })
      : syncHash
        ? await prisma.intervention.findUnique({ where: { syncHash: String(syncHash) } })
        : null;
    if (existing) {
      if (existing) {
        const intervention = await prisma.intervention.update({
          where: { reference: providedReference },
          data: {
            clientName: String(clientName).trim(),
            clientAddress: String(clientAddress).trim(),
            clientContactPhone: clientContactPhone ? String(clientContactPhone).trim() : '',
            problemReported: problemReported ? String(problemReported).trim() : '',
            type: type ? String(type).trim() : 'Maintenance',
            startTime: proposedTime ? String(proposedTime).trim() : existing.startTime,
            intent: intent ? String(intent) : undefined,
            symptom: symptom ? String(symptom) : undefined,
            ac_type: ac_type ? String(ac_type) : undefined,
            units: Number.isInteger(Number(units)) ? Number(units) : undefined,
            brand: brand ? String(brand) : undefined,
            btu: btu ? String(btu) : undefined,
            budget: Number.isFinite(Number(budget)) && budget !== null ? Number(budget) : undefined,
            room_area: Number.isFinite(Number(room_area)) && room_area !== null ? Number(room_area) : undefined,
            day: day ? String(day) : undefined,
            time_window: time_window ? String(time_window) : undefined,
          }
        });
        return NextResponse.json({ success: true, data: intervention, updated: true });
      }
    }

    // Generate Reference: INT-YYYYMMDD-RANDOM (e.g., INT-20260826-A1B2)
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const dateString = `${dateParts.find(part => part.type === 'year')?.value}${dateParts.find(part => part.type === 'month')?.value}${dateParts.find(part => part.type === 'day')?.value}`;
    const randomStr = crypto.randomBytes(2).toString('hex').toUpperCase();
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
        startTime: proposedTime ? String(proposedTime).trim() : null,
        syncHash: syncHash ? String(syncHash) : null,
        intent: intent ? String(intent) : null,
        symptom: symptom ? String(symptom) : null,
        ac_type: ac_type ? String(ac_type) : null,
        units: Number.isInteger(Number(units)) && units !== null ? Number(units) : null,
        brand: brand ? String(brand) : null,
        btu: btu ? String(btu) : null,
        budget: Number.isFinite(Number(budget)) && budget !== null ? Number(budget) : null,
        room_area: Number.isFinite(Number(room_area)) && room_area !== null ? Number(room_area) : null,
        day: day ? String(day) : null,
        time_window: time_window ? String(time_window) : null,
      }
    });

    return NextResponse.json({ success: true, data: intervention });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur inconnue";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
