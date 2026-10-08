"use strict";

function resolveDate(text, now = new Date()) {
    const txt = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '');
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const current = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    const base = new Date(Date.UTC(current.year, current.month - 1, current.day));
    const iso = txt.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) {
        const candidate = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
        return candidate.toISOString().slice(0, 10) === iso[0] ? iso[0] : null;
    }
    const explicit = txt.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (explicit) {
        const day = Number(explicit[1]);
        const month = Number(explicit[2]);
        let year = explicit[3] ? Number(explicit[3]) : current.year;
        if (year < 100) year += 2000;
        let candidate = new Date(Date.UTC(year, month - 1, day));
        if (candidate.getUTCDate() !== day || candidate.getUTCMonth() !== month - 1) return null;
        if (!explicit[3] && candidate < base) candidate = new Date(Date.UTC(year + 1, month - 1, day));
        return candidate.toISOString().slice(0, 10);
    }
    if (/\b(apres demain|apres-demain|after tomorrow)\b/.test(txt) || txt.includes('بعد غد')) base.setUTCDate(base.getUTCDate() + 2);
    else if (/\b(demain|tomorrow|gheda|ghdda|ghedwa)\b/.test(txt) || /غداً|غدا|غدًا/.test(txt)) base.setUTCDate(base.getUTCDate() + 1);
    else if (/\b(aujourdhui|today|lyoum|ce soir|sbah|sabah|l3chiya|3chiya)\b/.test(txt) || txt.includes('اليوم')) {
        return base.toISOString().slice(0, 10);
    } else {
        const days = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, ahad: 0, tnin: 1, tlat: 2, larb: 3, khemis: 4, jemaa: 5, sebt: 6 };
        const weekday = Object.entries(days).find(([day]) => new RegExp(`\\b${day}\\b`).test(txt));
        if (!weekday) return null;
        let diff = weekday[1] - base.getUTCDay();
        if (diff <= 0) diff += 7;
        base.setUTCDate(base.getUTCDate() + diff);
    }
    return base.toISOString().slice(0, 10);
}

function checkBusinessHours(dateStr, timeStr) {
    const hours = process.env.BUSINESS_HOURS || '9-20';
    const [start, end] = hours.split('-').map(Number);
    if (!timeStr) return true;
    const lower = String(timeStr).toLowerCase();
    const hasExplicitHour = /\b\d{1,2}(?:\s*(?::|h)\s*\d{2}|\s*h)?\b/.test(lower);
    if (!hasExplicitHour && (/\b(sbah|morning|matin)\b/.test(lower) || lower.includes('الصباح'))) return start < 12;
    if (!hasExplicitHour && (/\b(l3chiya|3chiya|afternoon|apres-midi|soir|evening)\b/.test(lower) || lower.includes('المساء'))) return end > 12;
    const match = lower.match(/(?:\b(\d{1,2})\s*(?::|h)\s*(\d{2})?\b|\b(\d{1,2})\s*h\b|\b(\d{1,2})\b)/);
    if (match) {
        let hour = Number(match[1] || match[3] || match[4]);
        const minute = Number(match[2] || 0);
        if ((lower.includes('pm') || lower.includes('l3chiya') || lower.includes('3chiya')) && hour < 12) hour += 12;
        const decimalHour = hour + minute / 60;
        if (decimalHour < start || decimalHour >= end) return false;
    }
    return true;
}

module.exports = { resolveDate, checkBusinessHours };
