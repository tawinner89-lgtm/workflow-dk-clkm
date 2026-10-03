// Pure data definitions for intents and slot collection
const FLOWS = {
    repair: {
        required: ["name", "address", "phone", "symptom", "day", "time_window_or_hour"],
        optional: ["ac_type"],
        order: ["symptom", "name", "address", "phone", "day", "time_window_or_hour"],
    },
    maintenance: {
        required: ["name", "address", "phone", "units", "ac_type", "symptom", "day", "time_window_or_hour"],
        optional: [],
        order: ["ac_type", "symptom", "units", "name", "address", "phone", "day", "time_window_or_hour"],
    },
    purchase: {
        required: ['name', 'address', 'phone', 'ac_type'],
        optional: [],
        order: ['ac_type', 'name', 'address', 'phone']
    },
    installation: {
        required: ["name", "address", "phone", "install_mode", "day", "time_window_or_hour"],
        optional: ["ac_type"],
        order: ["install_mode", "name", "address", "phone", "day", "time_window_or_hour"],
    },
    price: {
        required: ["ac_type"],
        optional: [],
        order: ["ac_type"]
    },
    job: {
        required: [],
        optional: ["name", "phone"],
        order: []
    }
};

const QUESTIONS = {
    symptom: {
        fr: ["Quel est le problème exact avec votre climatiseur ?", "Pouvez-vous me décrire le souci rencontré ?"],
        ar: ["شنو المشكل بالظبط لي عندك فالكليماتيزور؟", "ممكن تشرح ليا المشكل لي كاين؟"]
    },
    units: {
        fr: ["Combien de climatiseurs nécessitent un entretien ?", "Pour combien d'unités souhaitez-vous l'entretien ?"],
        ar: ["شحال من كليماتيزور بغيتي دير ليه لانتخوتيان؟", "شحال من ماكينة عندك؟"]
    },
    install_mode: {
        fr: ["Avez-vous déjà acheté le climatiseur ou souhaitez-vous l'acheter chez nous ?", "S'agit-il d'une installation seule ou avec achat ?"],
        ar: ["واش شريتي الكليماتيزور ولا بغيتي تشريه من عندنا؟", "واش بغيتي لانسطالاصيون بوحدها ولا مع السلعة؟"]
    },
    ac_type: {
        fr: ["Quel est le type de votre climatiseur (Split mural, Gainable, Cassette...) ?", "S'agit-il d'un split, gainable ou cassette ?"],
        ar: ["شنو نوع الكليماتيزور لي عندك (عادي، كاسيط، ولا كينابل)؟", "شنو ماركة ونوع الماكينة؟"]
    },
    name: {
        fr: ["Quel est votre nom complet s'il vous plaît ?", "Pourrais-je avoir votre nom et prénom ?"],
        ar: ["ممكن الاسم الكامل ديالك عافاك؟", "شنو سميتك؟"]
    },
    address: {
        fr: ["Quelle est votre adresse exacte (ou quartier/ville) ?", "Où vous trouvez-vous exactement ?"],
        ar: ["فين جات لادريس ديالك بالظبط (المدينة والحي)؟", "فين كاين نتا؟"]
    },
    phone: {
        fr: ["Pouvez-vous me confirmer votre numéro de téléphone ?", "Sur quel numéro pouvons-nous vous joindre ?"],
        ar: ["واش هادا هو النمرة لي نعيطو ليك فيها؟", "ممكن النمرة ديال التيليفون باش نتواصلو معاك؟"]
    },
    day: {
        fr: ["Quel jour vous conviendrait pour l'intervention ?", "Avez-vous une préférence pour le jour du passage ?"],
        ar: ["أينا نهار يناسبك باش يجي المعلم؟", "فوقاش بغيتي التكنيسيان يجي؟"]
    },
    time_window_or_hour: {
        fr: ["À quelle heure ou quelle partie de la journée (matin/après-midi) ?", "Vers quelle heure préférez-vous ?"],
        ar: ["أينا وقيتة بالظبط (الصباح ولا العشية)؟", "معاش بغيتيه يجي؟"]
    },
    booking_group: {
        fr: ["Pour finaliser, j'aurais besoin de votre nom complet, votre adresse exacte, ainsi que le jour et l'heure qui vous arrangent."],
        ar: ["باش نأكدو الطلب، خاصني غير الاسم ديالك، لادريس بالظبط، وفوقاش يناسبك (النهار والوقيتة)."]
    }
};

module.exports = { FLOWS, QUESTIONS };


