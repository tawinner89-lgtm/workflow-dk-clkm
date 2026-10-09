import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, createSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    const technicians = await prisma.technician.findMany({
      select: session?.role === 'ADMIN'
        ? { id: true, name: true, phone: true }
        : { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, data: technicians });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, password, phone, action } = await request.json();
    
    // Admin adding a technician
    if (action === 'create') {
      const session = await getSession();
      if (session?.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 403 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const created = await prisma.technician.create({
        data: { name, password: hashedPassword, phone }
      });
      return NextResponse.json({ success: true, data: { id: created.id, name: created.name } });
    }

    // Login logic
    const tech = await prisma.technician.findFirst({
      where: { name }
    });

    if (tech) {
      let isValid = false;
      const isHashed = tech.password.startsWith('$2a$') || tech.password.startsWith('$2b$');

      if (isHashed) {
        isValid = await bcrypt.compare(password, tech.password);
      } else {
        isValid = (password === tech.password);
        if (isValid) {
          const newHash = await bcrypt.hash(password, 10);
          await prisma.technician.update({ where: { id: tech.id }, data: { password: newHash } });
        }
      }

      if (isValid) {
        await createSession({ role: 'TECHNICIAN', id: tech.id, name: tech.name });
        return NextResponse.json({ success: true, data: { name: tech.name } });
      }
    }
    return NextResponse.json({ success: false, error: 'Mot de passe incorrect' }, { status: 401 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: "ID missing" }, { status: 400 });
    }

    await prisma.technician.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 403 });
    }

    const { id, name, password, phone } = await request.json();
    
    if (!id) {
      return NextResponse.json({ success: false, error: "ID missing" }, { status: 400 });
    }

    const updatedData: { name: string; phone: string; password?: string } = { name, phone };
    if (password) {
      updatedData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.technician.update({
      where: { id },
      data: updatedData
    });

    return NextResponse.json({ success: true, data: { id: updated.id, name: updated.name } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
