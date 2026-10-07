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
const { render } = require('../lib/v2/templates');
const { runTurn } = require('../lib/v2/engine');
const { createInventoryService } = require('../src/services/inventory');

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

test('company inquiry with j\'aimerais is normalized and recognized', async () => {
    const result = await interpret(async () => ({ text: '{"slot_updates":{}}', tokens: 0 }), {
        slots: {}, intent: null, stage: 'INITIAL', last_bot_question_slot: null
    }, "j'aimerais en savoir plus sur votre entreprise");
    assert.equal(result.question_asked, 'company');
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
    const invalid = await validate(null, 'Carrier 9000 BTU disponible à 9000 DH.', state, { type: 'answer_question' });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.type, 'hard');
    const validArabic = await validate(null, 'السعر ٤٣٩٩ درهم.', state, { type: 'answer_question' });
    assert.equal(validArabic.valid, true, JSON.stringify(validArabic));
    assert.equal((await validate(null, 'السعر ٩٠٠٠ درهم.', state, { type: 'answer_question' })).type, 'hard');
});

test('inventory records OUT_OF_STOCK and does not treat a zero-stock update as a sale', async () => {
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
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'OUT_OF_STOCK');
    assert.equal(calls.some(call => call.values?.includes('OUT_OF_STOCK')), true);
    assert.equal(calls.some(call => call.sql === 'COMMIT'), true);
    assert.equal(calls.at(-1).sql, 'RELEASE');
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
    assert.deepEqual(planner(inStock, { slot_updates: {} }), { type: 'ask', reason: 'collect_info', slots: ['budget'] });
    const outOfStock = structuredClone(base);
    outOfStock.flags.stock_check = { status: 'checked', available: false, alternatives: [] };
    assert.deepEqual(planner(outOfStock, { slot_updates: {} }), { type: 'ask', reason: 'alternative_brand', slots: ['brand'] });
});
