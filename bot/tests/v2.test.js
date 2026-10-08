"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveDate, checkBusinessHours } = require('../lib/v2/dates');
const { normalizeIntent } = require('../lib/v2/intent');
const { planner } = require('../lib/v2/planner');
const { interpret } = require('../lib/v2/interpret');
const { validate } = require('../lib/v2/validator');
const { render, getOffer } = require('../lib/v2/templates');
const { writeReply, WRITER_SYSTEM_PROMPT } = require('../lib/v2/writer');
const { runTurn } = require('../lib/v2/engine');
const { createInventoryService } = require('../src/services/inventory');
const { createInterventionService } = require('../src/services/interventions');
const { getMoroccanPhone } = require('../src/utils');
const { renderQrSvg } = require('../src/utils/qr');

test('project source and config files are UTF-8 without BOM or mojibake', () => {
    const root = path.resolve(__dirname, '..', '..');
    const roots = ['bot', 'dashboard/src', 'dashboard/scripts', 'dashboard/prisma', 'shared'];
    const textExtensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.json', '.prisma', '.sql', '.toml', '.md', '.css', '.bat']);
    const mojibakeMarkers = [String.fromCharCode(0x00c3), String.fromCharCode(0x00c2), `${String.fromCharCode(0x00e2)}${String.fromCharCode(0x20ac)}`, String.fromCharCode(0xfffd)];
    const files = [
        '.dockerignore', '.env.example', '.gitattributes', '.gitignore', 'Dockerfile', 'README.md', 'netlify.toml', 'package.json',
        'bot/package.json', 'bot/package-lock.json', 'dashboard/package.json', 'dashboard/package-lock.json', 'dashboard/next.config.mjs', 'dashboard/tsconfig.json'
    ].map(file => path.join(root, file));
    const visit = directory => {
        for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
            const relative = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(relative);
            else if (textExtensions.has(path.extname(entry.name))) files.push(path.join(root, relative));
        }
    };
    roots.forEach(visit);
    const uniqueFiles = [...new Set(files)];
    for (const file of uniqueFiles) {
        const bytes = fs.readFileSync(file);
        assert.equal(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, `${file} has a UTF-8 BOM`);
        const content = bytes.toString('utf8');
        const badLines = content.split(/\r?\n/).filter(line => mojibakeMarkers.some(marker => line.includes(marker)));
        assert.deepEqual(badLines, [], `${file} contains mojibake: ${badLines.join(' | ')}`);
    }
});

test('resolveDate handles tomorrow and Darija weekdays', () => {
    const now = new Date('2026-10-07T12:00:00.000Z'); // Wednesday in Casablanca
    assert.equal(resolveDate('demain', now), '2026-10-08');
    assert.equal(resolveDate('tnin', now), '2026-10-12');
    assert.equal(resolveDate('gheda', now), '2026-10-08');
    assert.equal(resolveDate('غدا', now), '2026-10-08');
    assert.equal(resolveDate('l3chiya', now), '2026-10-07');
    assert.equal(resolveDate('14/10', now), '2026-10-14');
});

test('checkBusinessHours recognizes half hours and afternoon expressions', () => {
    assert.equal(checkBusinessHours('2026-10-08', '14:30'), true);
    assert.equal(checkBusinessHours('2026-10-08', 'l3chiya'), true);
    assert.equal(checkBusinessHours('2026-10-08', 'l3chiya 21h'), false);
    assert.equal(checkBusinessHours('2026-10-08', '21:00'), false);
});

test('normalizeIntent maps common Darija HVAC terms', () => {
    assert.equal(normalizeIntent('panne kharb'), 'repair');
    assert.equal(normalizeIntent('clim kharban'), 'repair');
    assert.equal(normalizeIntent('Salam bghit nchri clim'), 'purchase');
    assert.equal(normalizeIntent('bghit nder tarkib'), 'installation');
    assert.equal(normalizeIntent('ma kayberredch, bghit tberid'), 'repair');
});

test('Moroccan contact phone accepts national numbers and rejects WhatsApp IDs', () => {
    assert.equal(getMoroccanPhone('0612345678'), '+212612345678');
    assert.equal(getMoroccanPhone('212612345678'), '+212612345678');
    assert.equal(getMoroccanPhone('115878888792276@c.us'), null);
});

test('WhatsApp QR is rendered locally without sending the pairing token to a QR service', () => {
    const svg = renderQrSvg('local-test-pairing-code');
    assert.match(svg, /^<svg /);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.equal(svg.includes('api.qrserver.com'), false);
    assert.equal(svg.includes('local-test-pairing-code'), false);
});

test('purchase price questions are detected without replacing the active purchase intent', async () => {
    const state = { slots: {}, intent: 'purchase', stage: 'COLLECT', last_bot_question_slot: 'budget' };
    const result = await interpret(async () => ({ text: '{"slot_updates":{},"question_asked":"price","intent_change":"purchase"}', tokens: 2 }), state, 'bch7al dayera CIAT 9000BTU ?');
    assert.equal(result.question_asked, 'price');
    assert.equal(result.intent_change, 'purchase');
    assert.equal(result.slot_updates.brand, 'CIAT');
    assert.equal(result.slot_updates.btu, '9000_BTU');
});

test('NLU uses a system prompt and extracts a multi-slot message in any order', async () => {
    let optsSeen;
    const result = await interpret(async (_prompt, opts) => {
        optsSeen = opts;
        return { text: JSON.stringify({ intent_change: 'purchase', slot_updates: { brand: 'Carrier', btu: '12000_BTU', name: 'Othman', address: 'Casa Hay Farah', phone: '0612345678' }, question_asked: 'price', detected_language: 'ar' }), tokens: 20 };
    }, { slots: {}, intent: null, stage: 'INITIAL', last_bot_question_slot: null }, 'Salam bghit Carrier 12000 bch7al Casa Hay Farah 0612345678');
    assert.match(optsSeen.system, /You are DK Clim NLU/);
    assert.equal(result.question_asked, 'price');
    assert.equal(result.slot_updates.brand, 'Carrier');
    assert.equal(result.slot_updates.btu, '12000_BTU');
    assert.equal(result.slot_updates.address, 'Casa Hay Farah');
    assert.equal(result.slot_updates.phone, '+212612345678');
});

test('corrections update a prior BTU and keep the active intent', async () => {
    const result = await interpret(async () => ({ text: '{"slot_updates":{}}', tokens: 0 }), {
        slots: { brand: 'CIAT', btu: '12000_BTU' }, intent: 'purchase', stage: 'COLLECT', last_bot_question_slot: null
    }, 'la bghit 9000');
    assert.equal(result.is_correction, true);
    assert.equal(result.slot_updates.btu, '9000_BTU');
    assert.equal(result.intent_change, null);
});

test('a rejected brand is cleared so the bot asks for the replacement instead of looping', async () => {
    const result = await interpret(async () => ({ text: '{"slot_updates":{},"is_correction":true}', tokens: 0 }), {
        slots: { brand: 'CIAT', btu: '9000_BTU' }, intent: 'purchase', stage: 'COLLECT', last_bot_question_slot: null
    }, 'la machi CIAT');
    assert.deepEqual(result.clear_slots, ['brand']);
    assert.equal(result.slot_updates.brand, undefined);
    const state = { slots: { brand: 'CIAT', btu: '9000_BTU' }, intent: 'purchase', stage: 'COLLECT', flags: { stock_check: { status: 'checked', available: true } }, ask_count: 0 };
    const turn = await runTurn(async () => ({ text: '{"slot_updates":{}}', tokens: 0 }), state, 'la machi CIAT', []);
    assert.equal(turn.newState.slots.brand, undefined);
    assert.equal(turn.newState.flags.stock_check, undefined);
    assert.deepEqual(turn.nextAction, { type: 'ask', reason: 'collect_info', slots: ['brand'] });
});

test('lost buyer is asked room area and budget together', async () => {
    const state = { slots: {}, intent: null, stage: 'INITIAL', ask_count: 0, flags: {} };
    const result = await interpret(async () => { throw new Error('lost message should be detected locally'); }, state, 'ma3reftch ach nakhod');
    assert.equal(result.is_lost, true);
    const action = planner(state, result);
    assert.deepEqual(action, { type: 'ask', reason: 'recommendation_group', slots: ['recommendation_group'] });
    assert.match(render({ language: 'ar' }, action), /surface.*budget/i);
    assert.equal(state.intent, 'purchase');
});

test('CIAT 9000 price and stock answer never re-asks for budget', () => {
    const state = { intent: 'purchase', language: 'ar', slots: { brand: 'CIAT', btu: '9000_BTU' }, flags: { stock_check: { status: 'checked', available: true, stock_quantity: 1 } } };
    const action = planner(state, { question_asked: 'price', slot_updates: {} });
    assert.equal(action.reason, 'purchase_price_booking');
    const reply = render(state, action);
    assert.match(reply, /3800 DH TTC/);
    assert.match(reply, /1 f stock/);
    assert.match(reply, /smiytek.*numra.*adresse/i);
    assert.doesNotMatch(reply, /budget/i);
});

test('catalog prices match the supplied TTC list and Carrier stores normal and promo prices', () => {
    assert.equal(getOffer('Daikool', '9000_BTU').prix_promo, 3300);
    assert.equal(getOffer('CIAT', '9000_BTU').prix_promo, 3800);
    assert.equal(getOffer('TCL', '9000_BTU', 'Gris ON/OFF').prix_promo, 3200);
    assert.equal(getOffer('Carrier', '9000_BTU').prix_normal, 5999);
    assert.equal(getOffer('Carrier', '9000_BTU').prix_promo, 4399);
    assert.equal(getOffer('TCL', '12000_BTU').prix_promo, 4000);
});

test('TCL 9000 Gris quote uses its exact variant price', () => {
    const state = { intent: 'purchase', language: 'ar', slots: { brand: 'TCL', btu: '9000_BTU', model_variant: 'Gris ON/OFF' }, flags: { stock_check: { status: 'checked', available: true, stock_quantity: 1 } } };
    const reply = render(state, { type: 'answer_question', reason: 'purchase_price_booking', slots: ['price'] });
    assert.match(reply, /3200 DH TTC/);
    assert.doesNotMatch(reply, /3500|3700/);
});

test('NLU recognizes a TCL color answer after asking which model variant', async () => {
    const result = await interpret(async () => ({ text: '{"slot_updates":{}}', tokens: 0 }), {
        slots: { brand: 'TCL', btu: '9000_BTU' }, intent: 'purchase', stage: 'COLLECT', last_bot_question_slot: 'model_variant'
    }, 'Gris');
    assert.equal(result.slot_updates.model_variant, 'Gris ON/OFF');
});

test('Carrier quote shows both the normal and promotional TTC prices', () => {
    const state = { intent: 'purchase', language: 'fr', slots: { brand: 'Carrier', btu: '9000_BTU' }, flags: { stock_check: { status: 'checked', available: true, stock_quantity: 1 } } };
    const reply = render(state, { type: 'answer_question', reason: 'purchase_price_booking', slots: ['price'] });
    assert.match(reply, /5999 DH TTC/);
    assert.match(reply, /4399 DH TTC/);
});

test('company inquiry with j\'aimerais is normalized and recognized', async () => {
    const result = await interpret(async () => ({ text: '{"slot_updates":{}}', tokens: 0 }), {
        slots: {}, intent: null, stage: 'INITIAL', last_bot_question_slot: null
    }, "j'aimerais en savoir plus sur votre entreprise");
    assert.equal(result.question_asked, 'company');
});

test('company reply does not restrict DK Clim service to Casablanca', () => {
    const reply = render({ language: 'fr' }, { type: 'answer_question', slots: ['company'] });
    assert.doesNotMatch(reply, /à Casablanca|dans la région de Casablanca/i);
    assert.match(reply, /votre ville/i);
    assert.match(WRITER_SYSTEM_PROMPT, /not restricted to Casablanca/i);
    assert.match(WRITER_SYSTEM_PROMPT, /any city/i);
});

test('booking asks never expose hallucinated booking-group fields', async () => {
    let providerCalls = 0;
    const result = await writeReply(async () => { providerCalls++; return { text: 'What booking group?', tokens: 1 }; },
        { intent: 'repair', language: 'ar', slots: {} },
        { type: 'ask', reason: 'collect_info', slots: ['booking_group_name'] });
    assert.equal(providerCalls, 0);
    assert.equal(result.deterministic, true);
    assert.doesNotMatch(result.text, /group|groupe|booking/i);
});

test('fixed replies follow French, Darija Latin, and Arabic-script language selection', () => {
    const action = { type: 'ask', slots: ['btu'] };
    assert.match(render({ language: 'fr' }, action), /^Quelle puissance/);
    assert.match(render({ language: 'ar' }, action), /^Ch7al/);
    assert.match(render({ language: 'ar-script' }, action), /[\u0600-\u06ff]/u);
});

test('clear purchase opener uses the fast path and identifies the default Darija language', async () => {
    let providerCalls = 0;
    const result = await interpret(async () => { providerCalls++; throw new Error('should not be called'); }, {
        slots: {}, intent: null, stage: 'INITIAL', last_bot_question_slot: null
    }, 'Salam bghit nchri clim');
    assert.equal(providerCalls, 0);
    assert.equal(result.intent_change, 'purchase');
    assert.equal(result.detected_language, 'ar');
});

test('simple purchase opener completes interpret, planner and writer under 1.5 seconds without provider calls', async () => {
    let providerCalls = 0;
    const state = { slots: {}, flags: {}, stage: 'INITIAL', language: 'ar', ask_count: 0 };
    const started = process.hrtime.bigint();
    const result = await runTurn(async () => { providerCalls++; throw new Error('provider must be skipped'); }, state, 'Salam bghit nchri clim', []);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.equal(providerCalls, 0);
    assert.equal(result.nextAction.slots[0], 'btu');
    assert.match(result.reply, /BTU/);
    assert.ok(elapsedMs < 1500, `local sales flow took ${elapsedMs.toFixed(1)}ms`);
});

test('validator allows catalog prices and rejects a BTU value used as an invented price', async () => {
    const state = { intent: 'purchase', slots: { brand: 'Carrier', btu: '9000_BTU' }, flags: {} };
    assert.equal((await validate(null, 'Carrier 9000 BTU disponible à 4399 DH.', state, { type: 'answer_question' })).valid, true);
    assert.equal((await validate(null, 'CIAT 9000 BTU à 3800 DH TTC.', { ...state, slots: { brand: 'CIAT', btu: '9000_BTU' } }, { type: 'answer_question' })).valid, true);
    assert.equal((await validate(null, 'CIAT 9000 BTU à 3490 DH TTC.', { ...state, slots: { brand: 'CIAT', btu: '9000_BTU' } }, { type: 'answer_question' })).type, 'hard');
    assert.equal((await validate(null, 'Diagnostic à 200 DH.', { ...state, intent: 'repair' }, { type: 'answer_question' })).type, 'hard');
    const invalid = await validate(null, 'Carrier 9000 BTU disponible à 9000 DH.', state, { type: 'answer_question' });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.type, 'hard');
    const validArabic = await validate(null, 'السعر ٤٣٩٩ درهم.', state, { type: 'answer_question' });
    assert.equal(validArabic.valid, true, JSON.stringify(validArabic));
    assert.equal((await validate(null, 'السعر ٩٠٠٠ درهم.', state, { type: 'answer_question' })).type, 'hard');
});

test('inventory records a zero-stock request as PREORDER without decrementing stock', async () => {
    const calls = [];
    const fakePool = {
        connect: async () => ({
            query: async (sql, values) => {
                calls.push({ sql, values });
                if (sql.includes('UPDATE "Inventory"')) return { rowCount: 0, rows: [] };
                if (sql.includes('SELECT stock_quantity')) return { rowCount: 1, rows: [{ stock_quantity: 0 }] };
                return { rowCount: 1, rows: [] };
            },
            release: () => calls.push({ sql: 'RELEASE' })
        })
    };
    const inventory = createInventoryService(fakePool);
    const result = await inventory.recordSale('Carrier', '9000_BTU', 'Test Client', '+212612345678');
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'PREORDER');
    assert.equal(result.status, 'PREORDER');
    assert.equal(calls.some(call => call.values?.includes('PREORDER')), true);
    assert.match(calls.find(call => call.values?.includes('PREORDER')).values.at(-1), /Commande spéciale 24-48h/);
    assert.equal(calls.some(call => call.sql === 'COMMIT'), true);
    assert.equal(calls.at(-1).sql, 'RELEASE');
});

test('availability distinguishes a zero quantity as eligible for preorder', async () => {
    const inventory = createInventoryService({
        query: async () => ({ rows: [{ brand: 'Carrier', btu: '9000_BTU', stock_quantity: 0 }] }),
    });
    const result = await inventory.getProductAvailability('Carrier', '9000_BTU');
    assert.equal(result.available, false);
    assert.equal(result.can_preorder, true);
    assert.equal(result.stock_quantity, 0);
});

test('planner groups remaining booking details into one booking_group ask', () => {
    const state = { intent: 'repair', stage: 'COLLECT', ask_count: 0, slots: { symptom: 'ma kayberredch' }, flags: {} };
    const action = planner(state, { slot_updates: {}, intent_change: null });
    assert.deepEqual(action, { type: 'ask', reason: 'booking_group', slots: ['booking_group'] });
});

test('planner still asks the repair symptom before grouping booking details', () => {
    const state = { intent: 'repair', stage: 'COLLECT', ask_count: 0, slots: {}, flags: {} };
    const action = planner(state, { slot_updates: {}, intent_change: null });
    assert.deepEqual(action, { type: 'ask', reason: 'collect_info', slots: ['symptom'] });
});


test('purchase planning requires a successful inventory check before collecting close details', () => {
    const base = { intent: 'purchase', stage: 'COLLECT', ask_count: 0, slots: { brand: 'Carrier', btu: '9000_BTU' }, flags: {} };
    assert.equal(planner(structuredClone(base), { slot_updates: {} }).reason, 'inventory_check_failed');
    const inStock = structuredClone(base);
    inStock.flags.stock_check = { status: 'checked', available: true, alternatives: [] };
    assert.deepEqual(planner(inStock, { slot_updates: {} }), { type: 'ask', reason: 'booking_group', slots: ['booking_group'] });
    const outOfStock = structuredClone(base);
    outOfStock.flags.stock_check = { status: 'checked', available: false, alternatives: [] };
    assert.deepEqual(planner(outOfStock, { slot_updates: {} }), { type: 'ask', reason: 'alternative_brand', slots: ['brand'] });
});

test('a client yes after a complete service recap confirms and queues an intervention', async () => {
    const state = {
        intent: 'repair', stage: 'RECAP', language: 'ar', ask_count: 0,
        slots: { name: 'Test Client', address: 'Casa', phone: '+212612345678', symptom: 'ma kayberredch', day: '2026-10-08', time_window_or_hour: '14:30' },
        flags: {}, last_bot_question_slot: null,
    };
    const result = await runTurn(async () => { throw new Error('confirmation should use deterministic path'); }, state, 'wakha', []);
    assert.equal(result.isAppointmentConfirmed, true);
    assert.deepEqual(result.nextAction, { type: 'close', reason: 'booking_confirmed', slots: [] });
    assert.match(result.reply, /talab dyalek tsjjel/i);
});

test('confirmed booking is inserted into the shared dashboard intervention table and assigned', async () => {
    const calls = [];
    const fakePool = {
        connect: async () => ({
            query: async (sql, values) => {
                calls.push({ sql, values });
                if (sql.includes('INSERT INTO "InterventionSync"')) return { rowCount: 1, rows: [{ hash: values[0] }] };
                if (sql.includes('FROM "Technician"')) return { rowCount: 1, rows: [{ name: 'Hamza', phone: '0612345678' }] };
                if (sql.includes('INSERT INTO "Intervention"')) return { rowCount: 1, rows: [{ reference: values[1], clientName: values[2], clientAddress: values[3], clientContactPhone: values[4], technicianName: values[5], type: values[6], startTime: values[7], problemReported: values[8] }] };
                return { rowCount: 1, rows: [] };
            },
            release: () => calls.push({ sql: 'RELEASE' }),
        }),
    };
    const service = createInterventionService(fakePool);
    const result = await service.createConfirmedBooking('212612345678@c.us', 'repair', {
        name: 'Test Client', address: 'Casa', phone: '+212612345678', symptom: 'ma kayberredch', day: '2026-10-08', time_window_or_hour: '14:30',
    });
    assert.equal(result.ok, true);
    assert.match(calls.find((call) => call.sql.includes('INSERT INTO "Intervention"')).values[0], /^[0-9a-f-]{36}$/i);
    assert.equal(result.technician.name, 'Hamza');
    assert.equal(result.intervention.type, 'Réparation');
    assert.equal(calls.some((call) => call.sql.includes('INSERT INTO "Intervention"')), true);
    assert.equal(calls.some((call) => call.sql === 'COMMIT'), true);
    assert.equal(calls.at(-1).sql, 'RELEASE');
});
