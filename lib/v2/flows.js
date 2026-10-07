"use strict";
const FLOWS = {
    repair: {
        required: ["name", "address", "phone", "symptom", "day", "time_window_or_hour"],
        optional: ["ac_type"],
        order: ["symptom", "ac_type", "name", "address", "phone", "day", "time_window_or_hour"],
    },
    maintenance: {
        required: ["name", "address", "phone", "units", "ac_type", "symptom", "day", "time_window_or_hour"],
        optional: [],
        order: ["ac_type", "symptom", "units", "name", "address", "phone", "day", "time_window_or_hour"],
    },
    purchase: {
        required: ['brand', 'btu', 'install_mode', 'name', 'address', 'phone', 'ac_type'],
        optional: [],
        order: ['ac_type', 'brand', 'btu', 'install_mode', 'name', 'address', 'phone']
    },
    installation: {
        required: ["name", "address", "phone", "install_mode", "day", "time_window_or_hour"],
        optional: ["ac_type"],
        order: ["install_mode", "ac_type", "name", "address", "phone", "day", "time_window_or_hour"],
    },
    price: { required: ["ac_type"], optional: [], order: ["ac_type"] },
    job: { required: [], optional: ["name", "phone"], order: [] }
};

const QUESTIONS = {
    symptom: {
        fr: ["Quel est le probleme exact avec votre climatiseur ?", "Pouvez-vous me decrire le souci rencontre ?"],
        ar: ["شنو المشكل بالظبط لي عندك فالكليماتيزور؟", "ممكن تشرح ليا المشكل لي كاين؟"]
    },
    units: {
        fr: ["Combien de climatiseurs necessitent un entretien ?", "Pour combien d'unites souhaitez-vous l'entretien ?"],
        ar: ["شحال من كليماتيزور بغيتي دير ليه لانتخوتيان؟", "شحال من ماكينة عندك؟"]
    },
    install_mode: {
        fr: ["Avez-vous deja achete le climatiseur ou souhaitez-vous l'acheter chez nous ?", "S'agit-il d'une installation seule ou avec achat ?"],
        ar: ["واش شريتي الكليماتيزور ولا بغيتي تشريه من عندنا؟", "واش بغيتي لانسطالاصيون بوحدها ولا مع السلعة؟"]
    },
    ac_type: {
        fr: ["Quel est le type de votre climatiseur (Split mural, Gainable, Cassette...) ?", "S'agit-il d'un split, gainable ou cassette ?"],
        ar: ["شنو نوع الكليماتيزور لي عندك (عادي، كاسيط، ولا كينابل)؟", "شنو ماركة ونوع الماكينة؟"]
    },
    brand: {
        fr: ['Quelle marque de climatiseur souhaitez-vous acheter ?', 'Avez-vous une preference pour la marque ?'],
        ar: ['أينا ماركة بغيتي (كاريير، سيات، دايكول، تي سي إل)؟', 'واش عندك شي ماركة مفضلة؟']
    },
    btu: {
        fr: ['Quelle est la puissance souhaitee (9000 BTU, 12000 BTU, etc.) ?', 'De quelle puissance (BTU) avez-vous besoin ?'],
        ar: ['شحال من BTU بغيتي (9000، 12000، الخ)؟', 'شنو الجهد لي بغيتي (BTU)؟']
    },
    name: {
        fr: ["Quel est votre nom complet s'il vous plait ?", "Pourrais-je avoir votre nom et prenom ?"],
        ar: ["ممكن الاسم الكامل ديالك عافاك؟", "شنو سميتك؟"]
    },
    address: {
        fr: ["Quelle est votre adresse exacte (ou quartier/ville) ?", "Ou vous trouvez-vous exactement ?"],
        ar: ["فين جات لادريس ديالك بالظبط (المدينة والحي)؟", "فين كاين نتا؟"]
    },
    phone: {
        fr: ["Pouvez-vous me confirmer votre numero de telephone ?", "Sur quel numero pouvons-nous vous joindre ?"],
        ar: ["واش هادا هو النمرة لي نعيطو ليك فيها؟", "ممكن النمرة ديال التيليفون باش نتواصلو معاك؟"]
    },
    day: {
        fr: ["Quel jour vous conviendrait pour l'intervention ?", "Avez-vous une preference pour le jour du passage ?"],
        ar: ["أينا نهار يناسبك باش يجي المعلم؟", "فوقاش بغيتي التكنيسيان يجي؟"]
    },
    time_window_or_hour: {
        fr: ["A quelle heure ou quelle partie de la journee (matin/apres-midi) ?", "Vers quelle heure preferez-vous ?"],
        ar: ["أينا وقيتة بالظبط (الصباح ولا العشية)؟", "معاش بغيتيه يجي؟"]
    },
    booking_group: {
        fr: ["Pour finaliser, j'aurais besoin de votre nom complet, votre adresse exacte, ainsi que le jour et l'heure qui vous arrangent."],
        ar: ["باش نأكدو الطلب، خاصني غير الاسم ديالك، لادريس بالظبط، وفوقاش يناسبك (النهار والوقيتة)."]
    }
};

module.exports = { FLOWS, QUESTIONS };
