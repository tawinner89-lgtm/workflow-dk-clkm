// dates.js - Pure JS, no dependencies
function resolveDate(text, now = new Date()) {
    // Basic resolution for "lundi", "demain", etc in Africa/Casablanca context
    const txt = text.toLowerCase();
    
    let target = new Date(now.getTime());
    
    if (txt.includes("demain") && !txt.includes("après")) {
        target.setDate(target.getDate() + 1);
    } else if (txt.includes("après demain") || txt.includes("apres demain")) {
        target.setDate(target.getDate() + 2);
    } else if (txt.includes("aujourd'hui") || txt.includes("ce soir")) {
        // keep target as today
    } else {
        const days = {
            "dimanche": 0, "lundi": 1, "mardi": 2, "mercredi": 3,
            "jeudi": 4, "vendredi": 5, "samedi": 6,
            "ahad": 0, "tnin": 1, "tlat": 2, "larb": 3, "khemis": 4, "jemaa": 5, "sebt": 6
        };
        
        let foundDay = -1;
        for (const [k, v] of Object.entries(days)) {
            if (txt.includes(k)) {
                foundDay = v;
                break;
            }
        }
        
        if (foundDay !== -1) {
            let currentDay = target.getDay();
            let diff = foundDay - currentDay;
            if (diff <= 0) diff += 7; // next occurrence
            target.setDate(target.getDate() + diff);
        }
    }
    
    // Format YYYY-MM-DD
    return target.toISOString().split('T')[0];
}

function checkBusinessHours(dateStr, timeStr) {
    // Env fallback
    const hours = process.env.BUSINESS_HOURS || "9-20";
    const [start, end] = hours.split('-').map(Number);
    
    // Basic check if time is outside
    let hourMatch = timeStr ? timeStr.match(/(\d{1,2})h/) : null;
    if (hourMatch) {
        let h = parseInt(hourMatch[1], 10);
        if (h < start || h > end) {
            return false;
        }
    }
    return true;
}

module.exports = { resolveDate, checkBusinessHours };
