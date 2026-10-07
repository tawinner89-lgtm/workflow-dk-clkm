"use strict";

const crypto = require('node:crypto');
const { pool } = require('../config/db');

const SERVICE_LABELS = {
  repair: 'Réparation',
  maintenance: 'Entretien',
  installation: 'Installation',
};

function createInterventionService(dbPool) {
  async function createConfirmedBooking(userId, intent, slots) {
    const required = ['name', 'address', 'phone', 'day', 'time_window_or_hour'];
    if (intent === 'repair') required.push('symptom');
    if (intent === 'maintenance') required.push('units', 'ac_type', 'symptom');
    const missing = required.filter((slot) => !String(slots?.[slot] ?? '').trim());
    if (!SERVICE_LABELS[intent] || missing.length) {
      return { ok: false, reason: 'INCOMPLETE_BOOKING', missing };
    }

    const identity = JSON.stringify([
      userId,
      intent,
      slots.name,
      slots.address,
      slots.phone,
      slots.symptom || null,
      slots.day,
      slots.time_window_or_hour,
    ]);
    const syncHash = crypto.createHash('sha256').update(identity).digest('hex');
    let client;
    try {
      client = await dbPool.connect();
      await client.query('BEGIN');
      const reservation = await client.query(
        `INSERT INTO "InterventionSync" (hash, "createdAt") VALUES ($1, NOW())
         ON CONFLICT (hash) DO NOTHING RETURNING hash`,
        [syncHash]
      );
      if (reservation.rowCount === 0) {
        const existing = await client.query(
          `SELECT reference, "technicianName" FROM "Intervention" WHERE "syncHash" = $1 LIMIT 1`,
          [syncHash]
        );
        await client.query('COMMIT');
        return existing.rows.length
          ? { ok: true, duplicate: true, intervention: existing.rows[0], technician: null }
          : { ok: false, reason: 'DUPLICATE_IN_PROGRESS' };
      }

      const technicians = await client.query(
        `SELECT t.name, t.phone
         FROM "Technician" AS t
         WHERE t."isAvailable" = TRUE AND COALESCE(t.phone, '') <> ''
         ORDER BY (
           SELECT COUNT(*) FROM "Intervention" AS i
           WHERE i."technicianName" = t.name AND i.status IN ('PLANIFIEE', 'EN COURS')
         ) ASC, t.name ASC
         LIMIT 1 FOR UPDATE OF t`
      );
      const technician = technicians.rows[0] || null;
      const technicianName = technician?.name || 'A assigner (Bot)';
      const reference = `INT-${new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date()).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const id = crypto.randomUUID();
      const proposedTime = `${slots.day} ${slots.time_window_or_hour}`.trim();
      const problemReported = slots.symptom || `${SERVICE_LABELS[intent]} demandée par WhatsApp`;
      const result = await client.query(
        `INSERT INTO "Intervention" (
          id, reference, "clientName", "clientContactName", "clientAddress", "clientContactPhone",
          "technicianName", type, "startTime", "problemReported", status, intent, symptom,
          ac_type, units, brand, btu, budget, room_area, day, time_window, "syncHash", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $3, $4, $5, $6, $7, $8, $9, 'PLANIFIEE', $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
        ) RETURNING reference, "clientName", "clientAddress", "clientContactPhone", "technicianName", type, "startTime", "problemReported"`,
        [
          id,
          reference,
          String(slots.name).trim(),
          String(slots.address).trim(),
          String(slots.phone).trim(),
          technicianName,
          SERVICE_LABELS[intent],
          proposedTime,
          String(problemReported).trim(),
          intent,
          slots.symptom || null,
          slots.ac_type || null,
          slots.units ? Number(slots.units) : null,
          slots.brand || null,
          slots.btu || null,
          slots.budget ? Number(String(slots.budget).replace(/\D/g, '')) : null,
          slots.room_area ? Number(String(slots.room_area).replace(/\D/g, '')) : null,
          slots.day,
          slots.time_window_or_hour,
          syncHash,
        ]
      );
      await client.query('COMMIT');
      return { ok: true, duplicate: false, intervention: result.rows[0], technician };
    } catch (error) {
      try { await client?.query('ROLLBACK'); } catch (_) {}
      console.error('[INTERVENTION CREATE]', error.message);
      return { ok: false, reason: 'DATABASE_ERROR', error: error.message };
    } finally {
      client?.release();
    }
  }

  return { createConfirmedBooking };
}

module.exports = { ...createInterventionService(pool), createInterventionService, SERVICE_LABELS };
