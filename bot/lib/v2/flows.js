"use strict";
const business = require('../../../shared/business.json');
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
        required: ['btu', 'brand', 'name', 'address', 'phone'],
        optional: ['budget', 'room_area', 'install_mode', 'ac_type', 'day', 'time_window_or_hour'],
        order: ['btu', 'brand', 'name', 'address', 'phone']
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
    intent: {
        fr: ["Bonjour, comment pouvons-nous vous aider ? Nous proposons la vente, la réparation, l'entretien et l'installation de climatiseurs."],
        ar: ["Salam, kifach n9dro n3awnok? 3ndna chra, siyana, entretien w tarkib dyal lclim."]
    },
    symptom: {
        fr: ["Pouvez-vous décrire le problème de votre climatiseur ?"],
        ar: ["Chno lmochkil li kayn f lclim dyalek?", "Wsef lia lmochkil 3afak?"]
    },
    units: {
        fr: ["Combien de climatiseurs souhaitez-vous faire entretenir ?"],
        ar: ["Ch7al mn clim bghiti dir lih entretien?"]
    },
    install_mode: {
        fr: ["Avez-vous déjà acheté le climatiseur ou souhaitez-vous l'acheter chez nous ?"],
        ar: ["Wach chriti lclim wla bghiti techrih mn 3ndna?"]
    },
    ac_type: {
        fr: ["Quel type de climatiseur avez-vous : Split, Gainable ou Cassette ?"],
        ar: ["Chno no3 lclim dyalek (Split, Gainable, Cassette)?"]
    },
    brand: {
        fr: [`Quelle marque préférez-vous ? (${business.sales_catalog.brands_in_stock.join(', ')})`],
        ar: [`Ina marka bghiti techri? (${business.sales_catalog.brands_in_stock.join(', ')})`]
    },
    btu: {
        fr: ["Quelle puissance recherchez-vous ? Si vous ne la connaissez pas, indiquez la superficie de la pièce."],
        ar: [`Ch7al mn BTU bghiti? (${business.sales_catalog.btu_options.join(', ')})`]
    },
    budget: {
        fr: ["Quel budget avez-vous prévu pour le climatiseur ?"],
        ar: ["Ch7al lbudget li 7ad lclim? Goul lia ta9riban ch7al bghiti tsref."]
    },
    recommendation_group: {
        fr: ["Pour vous conseiller au mieux, quelle est la superficie de la pièce en m² et votre budget approximatif ?"],
        ar: ["Bach n3awnk a7sen haja, ch7al surface dyal lbit b m2 w budget ta9riban?"],
    },
    name: {
        fr: ["Quel est votre nom complet, s'il vous plaît ?"],
        ar: ["Momkin smiytek kamla 3afak?"]
    },
    address: {
        fr: ["Quelle est votre adresse complète ?"],
        ar: ["Fin jat l'adresse dyalek b dabt (lmdina w l7ay)?"]
    },
    phone: {
        fr: ["Quel numéro de téléphone pouvons-nous utiliser pour vous joindre ?"],
        ar: ["Chno howa raqm telephone dyalek bach ntwaslo m3ak?"]
    },
    day: {
        fr: ["Quel jour vous conviendrait pour l'intervention ?"],
        ar: ["Ina nhar ynasbek bach yji technicien?"]
    },
    time_window_or_hour: {
        fr: ["À quelle heure êtes-vous disponible ?"],
        ar: ["M3ach ynasbek l'waqt? Sbah ola l3chiya?"]
    },
    booking_group: {
        fr: ["Pour finaliser, indiquez votre nom, votre téléphone, votre adresse, le jour et l'heure qui vous conviennent."],
        ar: ["Bach nkemlo, khasni smiytek, raqm telephone, l'adresse, nhar w lwaqt li ynasbek."]
    }
};

module.exports = { FLOWS, QUESTIONS };
