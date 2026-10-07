"use strict";
const business = require('../../../shared/business.json');
function normalizeIntent(raw) {
    if (!raw) return null;
    let clean = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const repairHints = ['panne', 'kharb', 'khaser', 'khasra', 'mkhaser', 'mkhassar', 'makhdamch', 'ma kaykhdemch', 'ne refroidit pas', 'refroidit pas', 'ma kayberredch', 'tberid', 'fuite', 'bruit', 'depannage', 'reparation', 'sla7'];
    if (repairHints.some(hint => clean.includes(hint))) return 'repair';
    const maintenanceHints = ['entretien', 'nettoyage', 'maintenance', 'siyana', 'siyant'];
    if (maintenanceHints.some(hint => clean.includes(hint))) return 'maintenance';
    const installationHints = ['installation', 'installer', 'montage', 'tarkib', 'rkeb', 'nrakb'];
    if (installationHints.some(hint => clean.includes(hint))) return 'installation';
    const explicitPurchase = ['achat', 'acheter', 'buy', 'chra', 'chri', 'bghit nchri'].some(hint => clean.includes(hint));
    if (explicitPurchase) return 'purchase';
    const productHints = ['climatiseur', 'clim', 'btu', ...business.sales_catalog.brands_in_stock.map(brand => brand.toLowerCase())];
    const hasProductHint = productHints.some(hint => clean.includes(hint));
    if (hasProductHint) return 'purchase';
    const SYN = {
        'reparation': 'repair', 'depannage': 'repair', 'sla7': 'repair', 'repair': 'repair',
        'panne': 'repair', 'kharb': 'repair', 'kharban': 'repair', 'kharba': 'repair', 'khaser': 'repair', 'khasra': 'repair', 'mkhaser': 'repair', 'mkhassar': 'repair', 'ma kayberredch': 'repair', 'tberid': 'repair', 'ma kaykhdemch': 'repair',
        'entretien': 'maintenance', 'nettoyage': 'maintenance', 'maintenance': 'maintenance', 'nettoyage': 'maintenance', 'entretient': 'maintenance',
        'installation': 'installation', 'montage': 'installation', 'rkeb': 'installation', 'nrakb': 'installation', 'tarkib': 'installation', 'installer': 'installation',
        'achat': 'purchase', 'chra': 'purchase', 'buy': 'purchase', 'purchase': 'purchase', 'chri': 'purchase',
        'prix': 'price', 'tarif': 'price', 'taman': 'price', 'ch7al': 'price', 'combien': 'price', 'price': 'price', 'bch7al': 'price', 'devis': 'price', 'quote': 'price',
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
