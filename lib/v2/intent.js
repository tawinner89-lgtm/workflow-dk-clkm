function normalizeIntent(raw) {
    if (!raw) return null;
    let clean = raw.trim().toLowerCase();
    // remove accents
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const SYN = {
        'reparation': 'repair',
        'depannage': 'repair',
        'sla7': 'repair',
        'repair': 'repair',
        
        'entretien': 'maintenance',
        'nettoyage': 'maintenance',
        'maintenance': 'maintenance',
        
        'installation': 'installation',
        'montage': 'installation',
        'rkeb': 'installation',
        
        'achat': 'purchase',
        'chra': 'purchase',
        'buy': 'purchase',
        'purchase': 'purchase'
    };

    return SYN[clean] || null;
}

module.exports = { normalizeIntent };
