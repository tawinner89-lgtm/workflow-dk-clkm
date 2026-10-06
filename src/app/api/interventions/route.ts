import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

async function uploadBase64ToSupabase(reference: string, type: 'before' | 'after' | 'sig-tech' | 'sig-client', base64Data: string) {
  if (!base64Data.startsWith('data:image/')) return base64Data; // Already a URL or empty

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Supabase credentials missing, falling back to saving raw Base64.");
    return base64Data;
  }

  try {
    const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image data');
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const extension = mimeType.split('/')[1] || 'png';
    
    const buffer = Buffer.from(base64Content, 'base64');
    const path = `${reference}/${type}-${Date.now()}.${extension}`;

    const { error } = await supabaseAdmin.storage
      .from('interventions')
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error(`Supabase upload failed: ${error.message}, falling back to base64`);
      return base64Data;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('interventions')
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("Error during Supabase upload, falling back to base64", err);
    return base64Data;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    const url = new URL(request.url);
    const isAdminRequest = url.searchParams.get('admin') === 'true';

    // Strict Admin Check
    if (isAdminRequest && session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 401 });
    }

    const data = await request.json();
    const interventions = Array.isArray(data) ? data : [data];
    
    // Authorization Check
    if (session.role === 'TECHNICIAN') {
      for (const inv of interventions) {
        if (inv.technicianName !== session.name) {
          return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
        }
        
        // Prevent stealing an intervention by changing the name in the payload
        const existing = await prisma.intervention.findUnique({ where: { reference: inv.reference }, select: { technicianName: true } });
        if (existing && existing.technicianName !== session.name) {
          return NextResponse.json({ success: false, error: 'Accès refusé: Cette intervention appartient à un autre technicien' }, { status: 403 });
        }
      }
    }

    const results: { reference: string; status: string }[] = [];
    const errors: { reference: string; error: string }[] = [];

    for (const intervention of interventions) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, synced, ...payload } = intervention;
        
        if (Array.isArray(payload.workDone)) {
          payload.workDone = JSON.stringify(payload.workDone);
        }

        if (payload.photoBeforeUrl && payload.photoBeforeUrl.startsWith('data:image/')) {
          payload.photoBeforeUrl = await uploadBase64ToSupabase(payload.reference, 'before', payload.photoBeforeUrl);
        }
        if (payload.photoAfterUrl && payload.photoAfterUrl.startsWith('data:image/')) {
          payload.photoAfterUrl = await uploadBase64ToSupabase(payload.reference, 'after', payload.photoAfterUrl);
        }
        
        if (payload.signatureTechUrl && payload.signatureTechUrl.startsWith('data:image/')) {
          payload.signatureTechUrl = await uploadBase64ToSupabase(payload.reference, 'sig-tech', payload.signatureTechUrl);
        }
        if (payload.signatureClientUrl && payload.signatureClientUrl.startsWith('data:image/')) {
          payload.signatureClientUrl = await uploadBase64ToSupabase(payload.reference, 'sig-client', payload.signatureClientUrl);
        }

        const created = await prisma.intervention.upsert({
          where: { reference: payload.reference },
          update: {
            clientName: payload.clientName || undefined,
            clientAddress: payload.clientAddress || undefined,
            clientContactName: payload.clientContactName !== undefined ? payload.clientContactName : undefined,
            clientContactPhone: payload.clientContactPhone !== undefined ? payload.clientContactPhone : undefined,
            technicianName: payload.technicianName || undefined,
            type: payload.type || undefined,
            startTime: payload.startTime || undefined,
            endTime: payload.endTime || undefined,
            problemReported: payload.problemReported || undefined,
            workDone: payload.workDone || undefined,
            workDoneOther: payload.workDoneOther || undefined,
            materialsUsed: payload.materialsUsed || undefined,
            blowTemperature: payload.blowTemperature !== '' ? Number(payload.blowTemperature) : null,
            functioningTest: payload.functioningTest,
            photoBeforeUrl: payload.photoBeforeUrl || undefined,
            photoAfterUrl: payload.photoAfterUrl || undefined,
            observations: payload.observations || undefined,
            finalStatus: payload.finalStatus,
            signatureTechUrl: payload.signatureTechUrl || undefined,
            signatureClientUrl: payload.signatureClientUrl || undefined,
            status: payload.status || undefined,
          },
          create: {
            reference: payload.reference,
            clientName: payload.clientName,
            clientAddress: payload.clientAddress,
            clientContactName: payload.clientContactName || null,
            clientContactPhone: payload.clientContactPhone || null,
            technicianName: payload.technicianName,
            type: payload.type || null,
            startTime: payload.startTime || null,
            endTime: payload.endTime || null,
            problemReported: payload.problemReported || null,
            workDone: payload.workDone || '[]',
            workDoneOther: payload.workDoneOther || null,
            materialsUsed: payload.materialsUsed || null,
            blowTemperature: payload.blowTemperature !== '' && payload.blowTemperature !== undefined ? Number(payload.blowTemperature) : null,
            functioningTest: payload.functioningTest ?? null,
            photoBeforeUrl: payload.photoBeforeUrl || null,
            photoAfterUrl: payload.photoAfterUrl || null,
            observations: payload.observations || null,
            finalStatus: payload.finalStatus ?? null,
            signatureTechUrl: payload.signatureTechUrl || null,
            signatureClientUrl: payload.signatureClientUrl || null,
            status: payload.status || "PLANIFIEE",
          }
        });
        
        results.push({ reference: created.reference, status: 'success' });

        // ── WhatsApp notification when intervention is TERMINEE ──────────
        if (payload.status === 'TERMINEE' && created.clientContactPhone) {
          // Fire-and-forget: don't await, don't block the API response
          const botUrl = process.env.BOT_URL || 'http://localhost:3000';
          fetch(`${botUrl}/notify`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
              token          : process.env.WEBHOOK_SECRET || 'dkclim-ia-2026',
              phone          : created.clientContactPhone,
              clientName     : created.clientName,
              reference      : created.reference,
              technicianName : created.technicianName,
              type           : created.type,
              workDone       : created.workDone,
              workDoneOther  : created.workDoneOther,
              materialsUsed  : created.materialsUsed,
              observations   : created.observations,
              finalStatus    : created.finalStatus,
              startTime      : created.startTime,
              endTime        : created.endTime,
            }),
          }).catch(err => {
            console.error('[NOTIFY TRIGGER] Could not reach bot:', err.message);
          });
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error saving intervention ${intervention.reference}:`, err);
        errors.push({ reference: intervention.reference, error: msg });
      }
    }

    return NextResponse.json({ success: true, results, errors });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("API error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

  const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const technicianName = searchParams.get('technicianName');
    const full = searchParams.get('full') === 'true';
    const reference = searchParams.get('reference');
    const isAdminRequest = searchParams.get('admin') === 'true';

    // Strict Admin Check
    if (isAdminRequest && session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 401 });
    }

    const where: Prisma.InterventionWhereInput = {};
    if (status) where.status = status;
    if (reference) where.reference = reference;

    // Enforce role-based access
    if (session.role === 'TECHNICIAN') {
      where.technicianName = session.name;
    } else if (technicianName) {
      where.technicianName = technicianName;
    }

    const interventions = await prisma.intervention.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500, // MVP limit to protect performance
      ...(full ? {} : {
        select: {
          id: true,
          reference: true,
          clientName: true,
          clientAddress: true,
          clientContactName: true,
          clientContactPhone: true,
          technicianName: true,
          type: true,
          startTime: true,
          endTime: true,
          problemReported: true,
          workDone: true,
          workDoneOther: true,
          materialsUsed: true,
          blowTemperature: true,
          functioningTest: true,
          observations: true,
          finalStatus: true,
          status: true,
          createdAt: true,
        }
      })
    });

    if (reference && interventions.length === 1) {
      return NextResponse.json({ success: true, data: interventions[0] });
    }
    return NextResponse.json({ success: true, data: interventions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error("[API GET /interventions] Database fetch error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ success: false, error: "Reference missing" }, { status: 400 });
    }

    await prisma.intervention.delete({
      where: { reference }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}