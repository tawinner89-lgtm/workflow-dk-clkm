"use strict";
function normalizeIntent(raw) {
    if (!raw) return null;
    let clean = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const SYN = {
        'reparation': 'repair', 'depannage': 'repair', 'sla7': 'repair', 'repair': 'repair',
        'panne': 'repair', 'kharb': 'repair', 'khaser': 'repair', 'mkhassar': 'repair',
        'entretien': 'maintenance', 'nettoyage': 'maintenance', 'maintenance': 'maintenance', 'nettoyage': 'maintenance', 'entretient': 'maintenance',
        'installation': 'installation', 'montage': 'installation', 'rkeb': 'installation', 'tarkib': 'installation',
        'achat': 'purchase', 'chra': 'purchase', 'buy': 'purchase', 'purchase': 'purchase', 'chri': 'purchase',
        'prix': 'price', 'tarif': 'price', 'taman': 'price', 'ch7al': 'price', 'combien': 'price', 'price': 'price', 'bch7al': 'price',
        'emploi': 'job', 'recrutement': 'job', 'travail': 'job', 'job': 'job', 'khdma': 'job', 'stage': 'job'
    };
    // fuzzy: contains
    if (SYN[clean]) return SYN[clean];
    for (const [k,v] of Object.entries(SYN)) {
        if (clean.includes(k)) return v;
    }
    return null;
}
module.exports = { normalizeIntent };
