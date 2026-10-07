"use strict";
const business = require('../../../shared/business.json');

const TEMPLATES = {
    ask: {
        intent: {
            fr: "Bonjour, bienvenue chez DK Clim. Souhaitez-vous acheter un climatiseur, demander une réparation, un entretien ou une installation ?",
            ar: "Salam, mrehba bik f DK Clim! Wach bghiti techri clim, tṣiyen, entretien wla tarkib?",
            arabic: "مرحباً بك في DK Clim. هل ترغب في شراء مكيف، أو طلب إصلاح أو صيانة أو تركيب؟"
        },
        btu: {
            fr: "Quelle puissance vous faut-il ? Si vous ne la connaissez pas, indiquez la superficie de la pièce en m².",
            ar: `Ch7al mn BTU bghiti? Ila ma3reftich, goul lia surface dyal lbit b m2 (${business.sales_catalog.btu_options.join(', ')}).`,
            arabic: `ما القدرة التي تحتاجها؟ إذا لم تكن تعرفها، أخبرني بمساحة الغرفة بالمتر المربع (${business.sales_catalog.btu_options.join('، ')}).`
        },
        brand: {
            fr: `Quelle marque préférez-vous ? Nous proposons : ${business.sales_catalog.brands_in_stock.join(', ')}.`,
            ar: `Ina marka katfaddel? 3ndna: ${business.sales_catalog.brands_in_stock.join(', ')}.`,
            arabic: `ما العلامة التجارية التي تفضلها؟ المتوفر لدينا: ${business.sales_catalog.brands_in_stock.join('، ')}.`
        },
        budget: {
            fr: "Quel budget prévoyez-vous pour le climatiseur ?",
            ar: "Ch7al lbudget li 7ad lclim? Goul lia ta9riban ch7al bghiti tsref.",
            arabic: "ما الميزانية التي خصصتها للمكيف؟"
        },
        address: {
            fr: "Quelle est votre adresse complète à Casablanca ?",
            ar: "Fin jat l'adresse dyalek b dabt (lmdina w l7ay)?",
            arabic: "ما عنوانك الكامل في الدار البيضاء؟"
        },
        phone: {
            fr: "Quel numéro de téléphone pouvons-nous utiliser pour vous joindre ?",
            ar: "Chno howa raqm telephone dyalek bach ntwaslo m3ak?",
            arabic: "ما رقم الهاتف الذي يمكننا التواصل معك من خلاله؟"
        },
        name: {
            fr: "Quel est votre nom complet, s'il vous plaît ?",
            ar: "Momkin smiytek kamla 3afak?",
            arabic: "ما اسمك الكامل من فضلك؟"
        },
        ac_type: {
            fr: "Quel type de climatiseur avez-vous : Split, Gainable ou Cassette ?",
            ar: "Chno no3 lclim dyalek: Split, Gainable wla Cassette?",
            arabic: "ما نوع المكيف: جداري أم مخفي أم كاسيت؟"
        },
        symptom: {
            fr: "Pouvez-vous décrire le problème rencontré avec votre climatiseur ?",
            ar: "Wsef lia lmochkil li kayn f lclim dyalek 3afak?",
            arabic: "هل يمكنك وصف المشكلة التي تواجهها في المكيف؟"
        },
        units: {
            fr: "Combien de climatiseurs souhaitez-vous faire entretenir ?",
            ar: "Ch7al mn clim bghiti dir lih entretien?",
            arabic: "كم مكيفاً ترغب في صيانته؟"
        },
        install_mode: {
            fr: "Avez-vous déjà acheté le climatiseur, ou souhaitez-vous l'acheter chez nous ?",
            ar: "Wach chriti lclim wla bghiti techrih mn 3ndna?",
            arabic: "هل اشتريت المكيف بالفعل أم ترغب في شرائه منا؟"
        },
        day: {
            fr: "Quel jour vous conviendrait pour l'intervention ?",
            ar: "Ina nhar ynasbek bach yji technicien?",
            arabic: "ما اليوم المناسب لزيارة الفني؟"
        },
        time_window_or_hour: {
            fr: "À quelle heure êtes-vous disponible ?",
            ar: "M3ach ynasbek l'waqt? Sbah ola l3chiya?",
            arabic: "ما الوقت المناسب لك؟ صباحاً أم مساءً؟"
        },
        booking_group: {
            fr: "Pour finaliser, indiquez votre nom, votre téléphone, votre adresse, le jour et l'heure qui vous conviennent ?",
            ar: "Bach nkemlo, khasni smiytek, raqm telephone, l'adresse, nhar w lwaqt li ynasbek?",
            arabic: "لإتمام الطلب، أرسل اسمك ورقم هاتفك وعنوانك واليوم والوقت المناسبين لك."
        }
    },
    handoff: {
        fr: "Je transmets votre demande à notre équipe DK Clim, qui vous recontactera.",
        ar: "Ghadi n7awel talab dyalek l'équipe DK Clim bach y3ayto lik.",
        arabic: "سأحيل طلبك إلى فريق DK Clim ليتواصل معك."
    },
    urgency: {
        fr: "Votre situation semble urgente. Je préviens notre équipe pour qu'elle vous contacte rapidement.",
        ar: "Hadchi kayban mosta3jel. Ghadi n3ellem l'équipe bach ytaslo bik bser3a.",
        arabic: "يبدو أن الأمر طارئ. سأبلغ فريقنا ليتواصل معك سريعاً."
    },
    media_fallback: {
        fr: "Merci pour le fichier. Notre équipe va l'examiner et vous répondre.",
        ar: "Chokran 3la lfile. L'équipe ghadi tchoufou w tjawbek.",
        arabic: "شكراً على الملف. سيفحصه فريقنا ويرد عليك."
    },
    out_of_scope: {
        fr: "Je peux vous aider pour la vente, la réparation, l'entretien et l'installation de climatiseurs.",
        ar: "N9der n3awnek f chra, siyana, entretien w tarkib dyal lclim.",
        arabic: "يمكنني مساعدتك في بيع المكيفات وإصلاحها وصيانتها وتركيبها."
    },
    close: {
        confirmed: {
            fr: "Merci, votre demande est enregistrée. Notre équipe vous contactera pour la suite.",
            ar: "Chokran, talab dyalek tsjjel. L'équipe dyalna ghadi t3ayet lik bach tkml m3ak.",
            arabic: "شكراً، تم تسجيل طلبك. سيتواصل معك فريقنا للخطوات التالية."
        }
    }
};

function localeFor(state) {
    return state.language === 'fr' ? 'fr' : state.language === 'ar-script' ? 'arabic' : 'ar';
}

function getOffer(brand, btu) {
    const offers = business.sales_catalog.promotions_completes[String(brand || '').toLowerCase()] || [];
    return offers.find(offer => offer.btu.toUpperCase() === String(btu || '').toUpperCase()) || null;
}

function render(state, action) {
    const locale = localeFor(state);
    if (action.type === 'close' && action.reason === 'sale_pending') return TEMPLATES.close.confirmed[locale];
    if (action.type === 'close' && action.reason === 'confirmed') return TEMPLATES.close.confirmed[locale];
    if (action.type === 'silent') return '';
    if (action.type === 'handoff') return TEMPLATES.handoff[locale];
    if (action.type === 'urgency') return TEMPLATES.urgency[locale];
    if (action.type === 'media_fallback') return TEMPLATES.media_fallback[locale];
    if (action.type === 'out_of_scope') return TEMPLATES.out_of_scope[locale];
    if (action.type === 'ask' && action.reason === 'alternative_brand') {
        const alternative = state.flags?.stock_check?.alternatives?.[0];
        if (alternative) {
            const offer = getOffer(alternative.brand, alternative.btu);
            if (locale === 'fr') return `Le modèle ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU n'est pas disponible. Nous avons ${alternative.brand} de même puissance${offer?.prix_promo ? ` à ${offer.prix_promo} DH` : ''}. Cette alternative vous conviendrait-elle ?`;
            if (locale === 'arabic') return `المكيف ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} غير متوفر. لدينا ${alternative.brand} بالقدرة نفسها${offer?.prix_promo ? ` بسعر ${offer.prix_promo} درهم` : ''}. هل يناسبك هذا البديل؟`;
            return `Clim ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU ma kaynach daba. 3ndna ${alternative.brand} b nafs lpuissance${offer?.prix_promo ? ` b ${offer.prix_promo} DH` : ''}. Wach ynasbek had lbadil?`;
        }
        if (locale === 'fr') return `Ce modèle n'est pas disponible. Quelle autre puissance recherchez-vous ?`;
        if (locale === 'arabic') return `هذا الطراز غير متوفر حالياً. ما القدرة الأخرى التي تبحث عنها؟`;
        return `Had lmodele ma kaynach daba. Chno puissance okhra li bghiti?`;
    }
    if (action.type === 'ask' && action.slots?.length === 1) return TEMPLATES.ask[action.slots[0]]?.[locale] || null;
    if (action.type === 'answer_question' && action.reason === 'purchase_product_question') {
        const offer = getOffer(state.slots.brand, state.slots.btu);
        if (offer && state.flags?.stock_check?.available) {
            if (locale === 'fr') return `Oui, le ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU est disponible à ${offer.prix_promo} DH. La demande ne sera enregistrée qu'après votre accord.`;
            if (locale === 'arabic') return `نعم، مكيف ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} متوفر بسعر ${offer.prix_promo} درهم. لن نسجل الطلب إلا بعد موافقتك.`;
            return `Iyeh, clim ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU kayn b ${offer.prix_promo} DH. Ma ghadi nsejlo talab 7ta twafe9.`;
        }
        if (!state.slots.btu) return TEMPLATES.ask.btu[locale];
        if (!state.slots.brand) return TEMPLATES.ask.brand[locale];
        if (state.flags?.stock_check?.available) {
            if (locale === 'fr') return "Ce modèle est en stock, mais son prix exact doit être confirmé par notre équipe. Souhaitez-vous que je lui transmette votre demande ?";
            if (locale === 'arabic') return "هذا الطراز متوفر، لكن يجب أن يؤكد فريقنا سعره الدقيق. هل ترغب في إحالة طلبك إليهم؟";
            return "Had lmodele kayn f stock, walakin khas l'equipe t2aked taman b dabt. Bghiti n7awel lihom talab dyalek?";
        }
        return render(state, { type: 'ask', reason: 'alternative_brand', slots: ['brand'] });
    }
    if (action.type === 'answer_question' && action.slots?.[0] === 'company') {
        if (locale === 'fr') return "DK Clim accompagne ses clients à Casablanca pour la vente, l'installation, l'entretien et la réparation de climatiseurs. Quelle information souhaitez-vous connaître ?";
        if (locale === 'arabic') return "تقدم DK Clim في الدار البيضاء خدمات بيع المكيفات وتركيبها وصيانتها وإصلاحها. ما المعلومات التي ترغب في معرفتها؟";
        return "DK Clim kat3awn lclients f Casa f chra, tarkib, entretien w siyana dyal lclim. Chno lma3louma li bghiti t3ref?";
    }
    if (action.type === 'recap' && state.intent === 'purchase') {
        const offer = getOffer(state.slots.brand, state.slots.btu);
        if (!offer || !state.flags?.stock_check?.available || !offer.prix_promo) return TEMPLATES.handoff[locale];
        const price = `${offer.prix_promo} DH`;
        if (locale === 'fr') return `Récapitulatif : climatiseur ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU, ${price}. Adresse : ${state.slots.address}. Est-ce que je valide votre demande ?`;
        if (locale === 'arabic') return `ملخص الطلب: مكيف ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} وحدة، السعر ${price}. العنوان: ${state.slots.address}. هل أؤكد الطلب؟`;
        return `Talab dyalek: clim ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU, taman ${price}. L'adresse: ${state.slots.address}. Nvalidi lik talab?`;
    }
    if (action.type === 'recap') {
        if (locale === 'fr') return `Récapitulatif : ${state.intent}. Informations reçues : ${Object.entries(state.slots || {}).map(([key, value]) => `${key} : ${value}`).join(', ')}. Notre équipe vérifiera les disponibilités avant de fixer le rendez-vous.`;
        if (locale === 'arabic') return `ملخص الطلب: ${state.intent}. المعلومات المسجلة: ${Object.entries(state.slots || {}).map(([key, value]) => `${key}: ${value}`).join('، ')}. سيتحقق فريقنا من المواعيد المتاحة قبل تأكيد الموعد.`;
        return `Nrecap lik talab dyalek (${state.intent}): ${Object.entries(state.slots || {}).map(([key, value]) => `${key}: ${value}`).join(', ')}. L'equipe ghadi tchouf les disponibilites w t3ayet lik.`;
    }
    return null;
}

module.exports = { render, TEMPLATES, getOffer, localeFor };
