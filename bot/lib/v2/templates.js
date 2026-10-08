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
            fr: "Quelle est votre adresse complète, avec la ville et le quartier ?",
            ar: "Fin jat l'adresse dyalek b dabt (lmdina w l7ay)?",
            arabic: "ما عنوانك الكامل، مع ذكر المدينة والحي؟"
        },
        phone: {
            fr: "Quel numéro de téléphone pouvons-nous utiliser pour vous joindre ?",
            ar: "Chno howa raqm telephone dyalek bach ntwaslo m3ak?",
            arabic: "ما رقم الهاتف الذي يمكننا التواصل معك من خلاله؟"
        },
        phone_invalid: {
            fr: "Le numéro reçu semble incomplet. Envoyez un numéro marocain à 10 chiffres, par exemple 0612345678, s'il vous plaît ?",
            ar: "Raqm telephone li sifti kayban na9es. 3afak sift raqm marocain kamel b 10 ar9am, b7al 0612345678?",
            arabic: "يبدو أن رقم الهاتف ناقص. أرسل رقماً مغربياً كاملاً من 10 أرقام، مثل 0612345678 من فضلك؟"
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
    handoff_followup: {
        fr: "Votre demande est déjà transmise à notre équipe. Vous pouvez m'envoyer toute information complémentaire ici.",
        ar: "Talab dyalek deja 3nd l'équipe DK Clim. Ila bghiti tzid chi ma3louma, sift-ha lia hna.",
        arabic: "تمت إحالة طلبك إلى فريق DK Clim. يمكنك إرسال أي معلومات إضافية هنا."
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
        },
        preorder: {
            fr: "Votre commande spéciale est enregistrée, en attente d'importation sous 24 à 48 h. Notre équipe vous contactera pour la suite.",
            ar: "Talab spécial dyalek tsjjel ✅ Ghadi njibouh lik f 24-48 sa3a, w l'équipe dyalna ghadi t3ayet lik.",
            arabic: "تم تسجيل طلبك الخاص، ونتوقع توفيره خلال 24 إلى 48 ساعة. سيتواصل معك فريقنا للخطوات التالية."
        }
    }
};

function localeFor(state) {
    return state.language === 'fr' ? 'fr' : state.language === 'ar-script' ? 'arabic' : 'ar';
}

function getOffers(brand, btu) {
    return business.sales_catalog.promotions_completes.filter(offer => offer.brand.toLowerCase() === String(brand || '').toLowerCase() && offer.btu.toUpperCase() === String(btu || '').toUpperCase());
}

function getOffer(brand, btu, modele) {
    const offers = getOffers(brand, btu);
    if (modele) {
        const exact = offers.find(offer => offer.modele.toLowerCase() === String(modele).toLowerCase());
        if (exact) return exact;
    }
    return offers[0] || null;
}

function formatOfferPrice(offer, locale) {
    if (!offer) return '';
    const installation = offer.installation_incluse ? (locale === 'fr' ? ' Installation incluse.' : locale === 'arabic' ? ' التركيب مشمول.' : ' Tarkib dakhel f taman.') : '';
    if (offer.prix_normal) {
        if (locale === 'fr') return `Prix normal : ${offer.prix_normal} DH TTC, promotion actuelle : ${offer.prix_promo} DH TTC.${installation}`;
        if (locale === 'arabic') return `السعر العادي ${offer.prix_normal} درهم شامل الضريبة، وسعر العرض ${offer.prix_promo} درهم شامل الضريبة.${installation}`;
        return `Taman l3adi ${offer.prix_normal} DH TTC, promo daba ${offer.prix_promo} DH TTC.${installation}`;
    }
    if (locale === 'fr') return `Prix : ${offer.prix_promo} DH TTC.${installation}`;
    if (locale === 'arabic') return `${offer.prix_promo} درهم شامل الضريبة.${installation}`;
    return `${offer.prix_promo} DH TTC.${installation}`;
}

function purchaseDetailsQuestion(state, locale, offer) {
    const needed = ['name', 'phone', 'address'];
    if (state.slots?.install_mode === 'purchase_with_installation') needed.push('day', 'time_window_or_hour');
    const missing = needed.filter(slot => !state.slots?.[slot]);
    const installQuote = installationQuote(state, locale, offer);
    if (!missing.length) {
        if (locale === 'fr') return `${installQuote} Souhaitez-vous confirmer la commande ?`;
        if (locale === 'arabic') return `${installQuote} هل ترغب في تأكيد الطلب؟`;
        return `${installQuote} Wach bghiti nconfirmi lcommande?`;
    }
    const labels = {
        fr: { name: 'votre nom complet', phone: 'votre numéro de téléphone', address: 'la ville et le quartier de votre adresse', day: 'le jour souhaité pour l’installation', time_window_or_hour: 'l’heure souhaitée' },
        arabic: { name: 'اسمك الكامل', phone: 'رقم هاتفك', address: 'المدينة والحي', day: 'اليوم المناسب للتركيب', time_window_or_hour: 'الوقت المناسب' },
        ar: { name: 'smiytek kamla', phone: 'numra dyal telephone', address: 'lmdina w l7ay dyal l’adresse', day: 'nhar li ynasbek l tarkib', time_window_or_hour: 'lwaqt li ynasbek' },
    }[locale];
    const details = missing.map(slot => labels[slot]);
    if (locale === 'fr') return `${installQuote} Pour finaliser, indiquez ${details.join(', ')} s'il vous plaît.`;
    if (locale === 'arabic') return `${installQuote} لإتمام الطلب، أرسل ${details.join('، ')} من فضلك.`;
    return `${installQuote} Bach nkemlo lcommande, momkin tsift lina ${details.join(', ')} 3afak?`;
}

function installationQuote(state, locale, offer) {
    if (state.slots?.install_mode !== 'purchase_with_installation' || offer?.installation_incluse) return '';
    const amount = business.repair_and_maintenance.tarifs_services.installation;
    if (locale === 'fr') return ` La pose est à ${amount} DH TTC uniquement si le pré-câblage en cuivre est déjà installé ; sinon, un devis exact nécessite une visite sur place ou des frais de cuivre supplémentaires.`;
    if (locale === 'arabic') return `التركيب بـ ${amount} درهم شامل الضريبة إذا كانت أنابيب النحاس مركبة مسبقاً؛ وإلا يلزم معاينة في المكان أو احتساب تكلفة النحاس الإضافية.`;
    return ` Tarkib kayn b ${amount} DH TTC (ila kan n7as dayz). Hada thaman l’installasyon li 3andna f tarif. Ila ma kanch n7as dayz, taman d9i9 kay7taj ziyara l3in lmakane wla frais zyada dyal n7as.`;
}

function render(state, action) {
    const locale = localeFor(state);
    if (action.type === 'close' && action.reason === 'sale_preorder') return TEMPLATES.close.preorder[locale];
    if (action.type === 'close' && ['sale_pending', 'sale_confirmed', 'booking_confirmed', 'confirmed'].includes(action.reason)) return TEMPLATES.close.confirmed[locale];
    if (action.type === 'silent') return '';
    if (action.type === 'handoff_followup') return TEMPLATES.handoff_followup[locale];
    if (action.type === 'handoff') return TEMPLATES.handoff[locale];
    if (action.type === 'urgency') return TEMPLATES.urgency[locale];
    if (action.type === 'media_fallback') return TEMPLATES.media_fallback[locale];
    if (action.type === 'out_of_scope') return TEMPLATES.out_of_scope[locale];
    if (action.type === 'ask' && action.reason === 'alternative_brand') {
        const alternative = state.flags?.stock_check?.alternatives?.[0];
        if (alternative) {
            const offer = getOffer(alternative.brand, alternative.btu);
            const offerPrice = offer ? formatOfferPrice(offer, locale) : '';
            if (locale === 'fr') return `Le modèle ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU n'est pas disponible. Nous avons ${alternative.brand} de même puissance${offerPrice ? ` : ${offerPrice}` : ''}. Cette alternative vous conviendrait-elle ?`;
            if (locale === 'arabic') return `المكيف ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} غير متوفر. لدينا ${alternative.brand} بالقدرة نفسها${offerPrice ? `: ${offerPrice}` : ''}. هل يناسبك هذا البديل؟`;
            return `Clim ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU ma kaynach daba. 3ndna ${alternative.brand} b nafs lpuissance${offerPrice ? `: ${offerPrice}` : ''}. Wach ynasbek had lbadil?`;
        }
        if (locale === 'fr') return `Ce modèle n'est pas disponible. Quelle autre puissance recherchez-vous ?`;
        if (locale === 'arabic') return `هذا الطراز غير متوفر حالياً. ما القدرة الأخرى التي تبحث عنها؟`;
        return `Had lmodele ma kaynach daba. Chno puissance okhra li bghiti?`;
    }
    if (action.type === 'ask' && action.reason === 'recommendation_group') {
        if (locale === 'fr') return "Pour vous conseiller au mieux, quelle est la superficie de la pièce en m² et votre budget approximatif ?";
        if (locale === 'arabic') return "ما مساحة الغرفة بالمتر المربع وما ميزانيتك التقريبية؟";
        return "Bach n3awnk a7sen haja, ch7al surface dyal lbit b m2 w budget ta9riban?";
    }
    if (action.type === 'ask' && action.reason === 'booking_group' && state.intent === 'purchase' && state.flags?.recommended_offer) {
        const offer = state.flags.recommended_offer;
        const recommendationPrice = `${offer.price} DH TTC`;
        if (locale === 'fr') return `Pour une pièce de ${state.slots.room_area} m² et un budget de ${state.slots.budget} DH, je vous recommande le ${offer.brand} ${offer.btu.replace('_BTU', '')} BTU à ${recommendationPrice}, disponible en stock. Pour préparer la commande, indiquez votre nom complet, votre téléphone, votre adresse et le jour/heure de livraison souhaités, s'il vous plaît.`;
        if (locale === 'arabic') return `لغرفة مساحتها ${state.slots.room_area} م² وبميزانية ${state.slots.budget} درهم، أقترح ${offer.brand} بقدرة ${offer.btu.replace('_BTU', '')} BTU بسعر ${recommendationPrice}، وهو متوفر. لإعداد الطلب، أرسل اسمك الكامل ورقم هاتفك وعنوانك وموعد التسليم المناسب.`;
        return `Lbit dyal ${state.slots.room_area} m2 w budget ${state.slots.budget} DH, kanse7ek b ${offer.brand} ${offer.btu.replace('_BTU', '')} BTU b ${recommendationPrice}, kayn f stock. Bach nkemlo commande, sifet lia smiytek kamla, numra, l'adresse, w nhar/waqt dyal livraison.`;
    }
    if (action.type === 'ask' && action.reason === 'booking_group' && state.intent === 'purchase' && state.slots.brand && state.slots.btu) {
        const offer = getOffer(state.slots.brand, state.slots.btu, state.slots.model_variant);
        const stock = state.flags?.stock_check;
        const price = offer ? formatOfferPrice(offer, locale) : '';
        const detailsQuestion = purchaseDetailsQuestion(state, locale, offer);
        const installDetails = '';
        if (stock?.can_preorder) {
            if (locale === 'fr') return `${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU n'est pas en stock local. Nous pouvons le commander sous 24 à 48 h. ${price} ${detailsQuestion}`;
            if (locale === 'arabic') return `${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} غير متوفر محلياً. يمكننا طلبه خلال 24 إلى 48 ساعة. ${price} ${detailsQuestion}`;
            return `${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU daba ma kaynach f stock local, walakin n9edro njibouha f 24-48 sa3a. ${price} ${detailsQuestion}`;
        }
            if (locale === 'fr') return `${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU est disponible. ${price}${installDetails} ${detailsQuestion}`;
            if (locale === 'arabic') return `${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} متوفر. ${price}${installDetails} ${detailsQuestion}`;
            return `Salam, ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU kayn. ${price}${installDetails} ${detailsQuestion}`;
    }
    if (action.type === 'ask' && action.slots?.[0] === 'model_variant') {
        const options = getOffers(state.slots.brand, state.slots.btu).map(offer => `${offer.modele} : ${formatOfferPrice(offer, locale)}`);
        if (locale === 'fr') return `Quelle version préférez-vous : ${options.join(' ; ')} ?`;
        if (locale === 'arabic') return `أي نسخة تفضل: ${options.join('، ')}؟`;
        return `Ina version katfaddel: ${options.join(', ')}?`;
    }
    if (action.type === 'ask' && action.slots?.[0] === 'phone' && state.flags?.invalid_phone) return TEMPLATES.ask.phone_invalid[locale];
    if (action.type === 'ask' && action.slots?.length === 1) return TEMPLATES.ask[action.slots[0]]?.[locale] || null;
    if (action.type === 'answer_question' && action.reason === 'purchase_price_booking') {
        const offers = getOffers(state.slots.brand, state.slots.btu);
        const offer = getOffer(state.slots.brand, state.slots.btu, state.slots.model_variant);
        const stock = state.flags?.stock_check;
        if (!offer || !stock || stock.status !== 'checked') return TEMPLATES.handoff[locale];
        if (offers.length > 1 && !state.slots.model_variant) {
            const choices = offers.map(item => `${item.modele} : ${formatOfferPrice(item, locale)}`).join(locale === 'fr' ? ' ; ' : ', ');
            if (stock.can_preorder) {
                if (locale === 'fr') return `Ce modèle n'est pas en stock local ; une commande spéciale est possible sous 24 à 48 h. Voici les versions et leurs prix : ${choices}. Laquelle préférez-vous ?`;
                if (locale === 'arabic') return `هذا المكيف غير متوفر محلياً، ويمكن طلبه خلال 24 إلى 48 ساعة. هذه النسخ وأسعارها: ${choices}. أي نسخة تفضل؟`;
                return `Had lclim daba ma kaynch f stock local, walakin n9edro ntalbouh f 24-48 sa3a. Hado les versions b taman dyalhom: ${choices}. Ina wa7da katfaddel?`;
            }
            if (locale === 'fr') return `Le modèle ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU est disponible. Voici les versions : ${choices}. Quelle version préférez-vous ?`;
            if (locale === 'arabic') return `${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} متوفر. الاختيارات: ${choices}. أي نسخة تفضل؟`;
            return `${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU kayn. 3ndna: ${choices}. Ina modèle katfaddel?`;
        }
        if (stock.can_preorder) {
            if (locale === 'fr') return `${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU n'est pas en stock local, mais nous pouvons le commander sous 24 à 48 h. ${formatOfferPrice(offer, locale)} Pour continuer, indiquez votre nom complet, votre téléphone et votre adresse.`;
            if (locale === 'arabic') return `${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} غير متوفر محلياً، لكن يمكننا طلبه خلال 24 إلى 48 ساعة. ${formatOfferPrice(offer, locale)} للمتابعة، أرسل اسمك الكامل ورقم هاتفك وعنوانك.`;
            return `${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU daba 0 f stock local, walakin n9edro njibouh lik f 24-48 sa3a. ${formatOfferPrice(offer, locale)} Bach nkemlo, khasni smiytek kamla, numra w l'adresse.`;
        }
            if (locale === 'fr') return `Oui, le ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU est disponible. ${formatOfferPrice(offer, locale)} ${purchaseDetailsQuestion(state, locale, offer)}`;
            if (locale === 'arabic') return `نعم، ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} متوفر. ${formatOfferPrice(offer, locale)} ${purchaseDetailsQuestion(state, locale, offer)}`;
            return `Iyeh, ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU kayn. ${formatOfferPrice(offer, locale)} ${purchaseDetailsQuestion(state, locale, offer)}`;
    }
    if (action.type === 'answer_question' && action.reason === 'purchase_product_question') {
        const offer = getOffer(state.slots.brand, state.slots.btu, state.slots.model_variant);
        if (offer && state.flags?.stock_check?.available) {
            if (locale === 'fr') return `Oui, le ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU est disponible. ${formatOfferPrice(offer, locale)} La demande ne sera enregistrée qu'après votre accord.`;
            if (locale === 'arabic') return `نعم، مكيف ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')} متوفر. ${formatOfferPrice(offer, locale)} لن نسجل الطلب إلا بعد موافقتك.`;
            return `Iyeh, clim ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU kayn. ${formatOfferPrice(offer, locale)} Ma ghadi nsejlo talab 7ta twafe9.`;
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
        if (locale === 'fr') return "Le siège principal de DK Clim est à Casablanca. Nous proposons la vente, l'installation, l'entretien et la réparation de climatiseurs partout au Maroc. Quelle information souhaitez-vous connaître ?";
        if (locale === 'arabic') return "المقر الرئيسي لشركة DK Clim في الدار البيضاء، ونقدم خدمات بيع المكيفات وتركيبها وصيانتها وإصلاحها في جميع أنحاء المغرب. ما المعلومات التي ترغب في معرفتها؟";
        return "L siège principal dyal DK Clim kayn f Casablanca, w kan9edmo chra, tarkib, entretien w siyana dyal lclim f jami3 lmaghrib. Chno lma3louma li bghiti t3ref?";
    }
    if (action.type === 'recap' && state.intent === 'purchase') {
        const offer = getOffer(state.slots.brand, state.slots.btu, state.slots.model_variant);
        if (!offer || (!state.flags?.stock_check?.available && !state.flags?.stock_check?.can_preorder) || !offer.prix_promo) return TEMPLATES.handoff[locale];
        const price = formatOfferPrice(offer, locale);
        const installationSummary = installationQuote(state, locale, offer);
        if (state.flags?.stock_check?.can_preorder) {
            if (locale === 'fr') return `Récapitulatif : commande spéciale ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU, ${price}.${installationSummary} À fournir sous 24 à 48 h. Adresse : ${state.slots.address}. Est-ce que je confirme la commande ?`;
            if (locale === 'arabic') return `ملخص الطلب الخاص: ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')}، السعر ${price}.${installationSummary} التوفير خلال 24 إلى 48 ساعة. العنوان: ${state.slots.address}. هل أؤكد الطلب؟`;
            return `Talab spécial: ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU, ${price}.${installationSummary} Ghadi njibouh f 24-48 sa3a. L'adresse: ${state.slots.address}. Wach nconfirmi lik?`;
        }
        if (locale === 'fr') return `Récapitulatif : ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU. ${price}${installationSummary} Client : ${state.slots.name}, téléphone : ${state.slots.phone}, adresse : ${state.slots.address}${state.slots.day ? `, installation le ${state.slots.day}` : ''}${state.slots.time_window_or_hour ? ` vers ${state.slots.time_window_or_hour}` : ''}. Est-ce que je confirme la commande ?`;
        if (locale === 'arabic') return `ملخص الطلب: ${state.slots.brand} بقدرة ${state.slots.btu.replace('_BTU', '')}. ${price}${installationSummary} العميل: ${state.slots.name}، الهاتف: ${state.slots.phone}، العنوان: ${state.slots.address}${state.slots.day ? `، التركيب يوم ${state.slots.day}` : ''}${state.slots.time_window_or_hour ? ` حوالي ${state.slots.time_window_or_hour}` : ''}. هل أؤكد الطلب؟`;
        return `Talab dyalek: ${state.slots.brand} ${state.slots.btu.replace('_BTU', '')} BTU b ${price}.${installationSummary} Client: ${state.slots.name}, numra: ${state.slots.phone}, l'adresse: ${state.slots.address}${state.slots.day ? `, tarkib nhar ${state.slots.day}` : ''}${state.slots.time_window_or_hour ? ` f ${state.slots.time_window_or_hour}` : ''}. Wach nconfirmi lik?`;
    }
    if (action.type === 'recap') {
        if (locale === 'fr') return `Récapitulatif : ${state.intent}. Informations reçues : ${Object.entries(state.slots || {}).map(([key, value]) => `${key} : ${value}`).join(', ')}. Notre équipe vérifiera les disponibilités avant de fixer le rendez-vous.`;
        if (locale === 'arabic') return `ملخص الطلب: ${state.intent}. المعلومات المسجلة: ${Object.entries(state.slots || {}).map(([key, value]) => `${key}: ${value}`).join('، ')}. سيتحقق فريقنا من المواعيد المتاحة قبل تأكيد الموعد.`;
        return `Nrecap lik talab dyalek (${state.intent}): ${Object.entries(state.slots || {}).map(([key, value]) => `${key}: ${value}`).join(', ')}. L'equipe ghadi tchouf les disponibilites w t3ayet lik.`;
    }
    return null;
}

module.exports = { render, TEMPLATES, getOffer, getOffers, formatOfferPrice, localeFor };
