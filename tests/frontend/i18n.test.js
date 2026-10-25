import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { browser, templates, locales } from './helpers.js';

const fragments = [
    'shared/layout.html', 'components/tags-input/tags-input.html',
    'components/transaction-controls/transaction-controls.html',
    'components/expense-form/expense-form.html',
    'components/transaction-table/transaction-table.html',
    'components/chart/chart.html',
    'components/settings/preferences.html',
    'components/settings/recurring-transactions.html',
    'components/settings/import-export.html'
];
const settled = () => new Promise(resolve => setImmediate(resolve));

test('valid expense edit submits on the first click after invalid input and resets clear validation', async ctx => {
    const app = await browser(fragments, 'nl');
    ctx.after(app.close);
    const { createExpenseForm } = await app.import('components/expense-form/expense-form.js');
    const form = createExpenseForm({ getCategories: () => ['Food'], getTags: () => new Set(), onSaved: () => {} });
    form.refresh({ categories: ['Food'] });
    const element = app.document.getElementById('expenseForm');
    const name = app.document.getElementById('name');
    assert.equal(name.value, '');
    assert.equal(name.defaultValue, '');
    const amount = app.document.getElementById('amount');
    const submit = element.querySelector('button[type="submit"]');
    element.scrollIntoView = () => {};
    const requests = [];
    app.window.fetch = async (url, options) => {
        requests.push({ url, options });
        return { ok: true };
    };
    submit.click();
    assert.equal(amount.validity.customError, true);
    assert.equal(requests.length, 0);
    form.edit({ id: 'stable-id', name: 'Coffee', category: 'Food', amount: -5, date: '2026-10-25T12:00:00Z' });
    assert.equal(amount.validity.customError, false);
    submit.click();
    await settled();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/expense/edit?id=stable-id');
    assert.equal(JSON.parse(requests[0].options.body).amount, -5);
    assert.equal(name.value, '');
    submit.click();
    assert.equal(amount.validity.customError, true);
    element.reset();
    assert.equal(amount.validity.customError, false);
});

test('editing preserves an intentional dash name when clicked', async ctx => {
    const app = await browser(fragments);
    ctx.after(app.close);
    const { createExpenseForm } = await app.import('components/expense-form/expense-form.js');
    const form = createExpenseForm({ getCategories: () => ['Food'], getTags: () => new Set(), onSaved: () => {} });
    form.refresh({ categories: ['Food'] });
    app.document.getElementById('expenseForm').scrollIntoView = () => {};
    form.edit({ id: 'dash-name', name: '-', category: 'Food', amount: -5, date: '2026-10-25T12:00:00Z' });
    app.document.getElementById('name').click();
    assert.equal(app.document.getElementById('name').value, '-');
});

test('reopening a recurring edit clears previous custom validation errors', async ctx => {
    const app = await browser(fragments, 'nl');
    ctx.after(app.close);
    const { createSettingsRecurringTransactions } = await app.import('components/settings/recurring-transactions.js');
    const { validateField } = await app.import('shared/i18n.js');
    const recurring = createSettingsRecurringTransactions({
        categories: ['Food'],
        recurringExpenses: [{ id: 'stable-id', name: 'Coffee', category: 'Food', amount: -5,
            interval: 'monthly', startDate: '2026-10-25T12:00:00Z', occurrences: 2 }]
    });
    ctx.after(recurring.destroy);
    const edit = app.document.querySelector('[data-action="edit-recurring"]');
    edit.click();
    const field = app.document.getElementById('editRecurringName');
    field.value = '';
    validateField(field);
    assert.equal(field.validity.customError, true);
    app.document.querySelector('[data-action="close-edit"]').click();
    edit.click();
    assert.equal(field.value, 'Coffee');
    assert.equal(field.validity.customError, false);
    assert.equal(app.document.getElementById('editRecurringExpenseForm').checkValidity(), true);
});

for (const failedLanguage of ['en', 'nl']) {
    test(`cold start with failed ${failedLanguage} catalog preserves Dutch HTML and stops initialization`, async ctx => {
        const app = await browser(['pages/table/table.html', ...fragments], 'nl', { initialize: false });
        ctx.after(app.close);
        const { initI18n, t } = await app.import('shared/i18n.js');
        const english = JSON.parse(await fs.readFile(path.join(locales, 'en.json'), 'utf8'));
        const requests = [];
        app.window.fetch = async url => {
            requests.push(url);
            return url === `/locales/${failedLanguage}.json` ?
                { ok: false, status: 503 } : { ok: true, json: async () => english };
        };
        await assert.rejects(initI18n(), /Unable to load catalog/);
        assert.equal(app.document.documentElement.lang, 'nl');
        assert.equal(app.document.querySelector('#deleteModal h3').textContent, 'Uitgave verwijderen');
        const message = app.document.getElementById('translationError');
        assert.equal(message.hidden, false);
        assert.equal(message.textContent, 'Laden van de vertalingen mislukt. Vernieuw deze pagina.');
        assert.throws(() => t('common.save'), /Translations must initialize/);
        assert.ok(requests.includes(`/locales/${failedLanguage}.json`));
        await assert.rejects(app.import('pages/table/table.js'), /Unable to load catalog/);
        assert.equal(app.document.getElementById('currentMonth').textContent, '');
        assert.equal(requests.some(url => url === '/config' || url === '/expenses'), false);
    });
}

for (const language of ['en', 'nl']) {
    test(`${language}: dynamic controls, forms, intervals, errors and custom validation`, async ctx => {
        const app = await browser(fragments, language);
        ctx.after(app.close);
        const { t, errorText, validateField } = await app.import('shared/i18n.js');
        const { createTransactionControls } = await app.import('components/transaction-controls/transaction-controls.js');
        const controls = createTransactionControls(() => {});
        controls.applyConfig({ startDate: 1, showFutureTransactions: false, includeFutureTransactions: false });
        assert.match(app.document.getElementById('currentMonth').textContent, /\d{4}/);
        assert.equal(controls.futureMessage(), ' ' + t('controls.futureHiddenSettings'));
        const { formatMonth, formatDateFromUTC } = await app.import('shared/dates.js');
        assert.equal(formatMonth(new app.window.Date(2026, 0, 1)), language === 'nl' ? 'januari 2026' : 'January 2026');
        assert.equal(formatDateFromUTC('2026-01-02T12:00:00Z'), '02/01/2026');
        assert.equal(errorText({ code: 'errors.expenseName' }), t('errors.expenseName'));
        assert.equal(errorText({
            code: 'errors.categoryInvalid',
            params: { category: '<script>', reason: 'errors.categoryEmpty', message: 'English server error' }
        }), t('errors.categoryInvalid', { category: '<script>', message: t('errors.categoryEmpty') }));
        const field = app.document.getElementById('name');
        field.value = '';
        validateField(field);
        assert.equal(field.validationMessage, t('validation.required'));
        field.value = 'Coffee';
        field.dispatchEvent(new app.window.Event('input', { bubbles: true }));
        assert.equal(field.validationMessage, '');

        const { createSettingsRecurringTransactions } = await app.import('components/settings/recurring-transactions.js');
        const recurring = createSettingsRecurringTransactions({
            categories: ['Food'],
            recurringExpenses: [{ id: 'stable', name: '<script>', category: 'Food', amount: -5,
                interval: 'monthly', startDate: '2000-01-01T00:00:00Z', occurrences: 2 }]
        });
        ctx.after(recurring.destroy);
        assert.equal(app.document.querySelector('[data-field="interval"]').textContent, t('common.monthly'));
        assert.equal(app.document.querySelector('[data-field="next-occurrence"]').textContent, t('recurring.finished'));
        assert.equal(app.document.querySelector('[data-field="name"]').textContent, '<script>');
        assert.equal(app.document.querySelector('script:not([src])'), null);

        app.window.Chart = class {
            static defaults = { font: {} };
            constructor(_, config) { this.config = config; }
            destroy() {}
        };
        const { createChart } = await app.import('components/chart/chart.js');
        const chart = createChart();
        ctx.after(chart.destroy);
        chart.render({ expenses: [], categories: ['Food'], futureMessage: controls.futureMessage() });
        assert.equal(app.document.getElementById('noDataMessage').textContent, t('chart.empty') + controls.futureMessage());
        const { createTransactionTable } = await app.import('components/transaction-table/transaction-table.js');
        const table = createTransactionTable({ onEdit: () => {}, onDeleted: () => {} });
        for (const [range, key] of [['month', 'table.emptyMonth'], ['year', 'table.emptyYear'], ['all', 'table.emptyAll']]) {
            table.render([], { timeRange: range, currency: 'usd', futureMessage: '' });
            assert.equal(app.document.getElementById('tableContainer').textContent, t(key));
        }
        assert.equal(app.document.querySelector('#deleteModal h3').textContent, t('table.deleteTitle'));

        const selectedExpenses = [
            { id: 'hidden', name: 'First', category: 'Food delivery', amount: -10, tags: ['home'], date: '2026-01-02T12:00:00Z' },
            { id: 'target', name: '<script>', category: 'Food', amount: -5, tags: ['work'], date: '2026-01-02T12:00:00Z' }
        ];
        let edited;
        const filteredTable = createTransactionTable({ onEdit: id => { edited = id; }, onDeleted: () => {} });
        filteredTable.render(selectedExpenses, { timeRange: 'all', currency: 'usd', futureMessage: '' });
        assert.equal(app.document.getElementById('filter-category-display').textContent, t('table.allCategories'));
        assert.equal(app.document.getElementById('filter-tags-display').textContent, t('table.allTags'));
        const categoryInput = [...app.document.querySelectorAll('[data-multiselect="category"] input')]
            .find(input => input.value === 'Food');
        categoryInput.click();
        assert.equal(app.document.querySelectorAll('tbody [data-expense-id]').length, 1);
        assert.equal(app.document.querySelector('tbody [data-name]').textContent, '<script>');
        app.document.querySelector('[data-edit]').click();
        assert.equal(edited, 'target');
        assert.equal(app.document.querySelector('[data-edit]').getAttribute('aria-label'), t('common.edit'));
        assert.equal(app.document.getElementById('filter-category-display').textContent, 'Food');
        categoryInput.click();
        assert.equal(app.document.getElementById('filter-category-display').textContent, t('table.allCategories'));
        filteredTable.clearFilters();
        filteredTable.render(selectedExpenses, { timeRange: 'all', currency: 'usd', futureMessage: '' });
        assert.equal(app.document.getElementById('filter-tags-display').textContent, t('table.allTags'));

        const { createExpenseForm } = await app.import('components/expense-form/expense-form.js');
        const form = createExpenseForm({ getCategories: () => ['Food'], getTags: () => new Set(), onSaved: () => {} });
        form.refresh({ categories: ['Food'] });
        app.window.fetch = async () => ({ ok: false, json: async () => ({ code: 'errors.expenseAmount' }) });
        app.document.getElementById('amount').value = '1';
        app.document.getElementById('expenseForm').dispatchEvent(new app.window.Event('submit', { cancelable: true }));
        await settled();
        assert.equal(app.document.getElementById('formMessage').textContent,
            t('common.error', { message: t('errors.expenseAmount') }));
    });
}

test('catalog discovery, selector default and failed save preserve language', async ctx => {
    const app = await browser(fragments, 'nl');
    ctx.after(app.close);
    const { createSettingsPreferences } = await app.import('components/settings/preferences.js');
    const { t } = await app.import('shared/i18n.js');
    const requests = [];
    app.window.fetch = async (url, options) => {
        if (url === '/locales/') return { ok: true, json: async () => [
            { code: 'en', name: 'English' }, { code: 'nl', name: 'Nederlands' }, { code: 'fr', name: 'Français' }
        ] };
        requests.push({ url, options });
        return { ok: false, json: async () => ({ code: 'errors.languageSave' }) };
    };
    const preferences = createSettingsPreferences({});
    await preferences.ready;
    const select = app.document.getElementById('languageSelect');
    assert.equal(select.value, 'en');
    assert.deepEqual(Array.from(select.options, option => option.value), ['en', 'nl', 'fr']);
    select.value = 'nl';
    app.document.getElementById('saveLanguage').click();
    await settled();
    assert.equal(requests[0].url, '/language/edit');
    assert.equal(JSON.parse(requests[0].options.body), 'nl');
    assert.equal(app.document.getElementById('languageMessage').textContent, t('errors.languageSave'));
    assert.equal(app.document.documentElement.lang, 'nl');
    assert.equal(select.disabled, false);
    assert.equal(app.document.getElementById('saveLanguage').disabled, false);
});

test('i18next interpolation, plural support and missing-key failures', async ctx => {
    const app = await browser([], 'nl');
    ctx.after(app.close);
    const { t } = await app.import('shared/i18n.js');
    assert.equal(t('tags.create', { tag: '<b>test</b>' }), '+ "<b>test</b>" aanmaken');
    assert.throws(() => t('missing.key'), /Missing English translation/);
    assert.throws(() => t('tags.create'), /Missing interpolation parameter/);
    assert.equal(app.window.i18next, undefined);
    const { default: i18next } = await app.import('vendor/i18next.js');
    const instance = i18next.createInstance();
    await instance.init({ lng: 'nl', resources: { nl: { translation: {
        records_one: '{{count}} transactie', records_other: '{{count}} transacties'
    } } } });
    assert.equal(instance.t('records', { count: 1 }), '1 transactie');
    assert.equal(instance.t('records', { count: 2 }), '2 transacties');
});

test('HTML strings and referenced keys remain catalog-owned', async () => {
    const english = JSON.parse(await fs.readFile(path.join(locales, 'en.json'), 'utf8')).translation;
    const entries = await fs.readdir(templates, { recursive: true, withFileTypes: true });
    const attributes = ['title', 'placeholder', 'alt', 'aria-label', 'data-tooltip'];
    for (const entry of entries) {
        if (!entry.isFile() || !/\.(html|js)$/.test(entry.name) || entry.name.endsWith('.min.js')) continue;
        const file = path.join(entry.parentPath, entry.name);
        if (file.includes(`${path.sep}vendor${path.sep}`)) continue;
        const source = await fs.readFile(file, 'utf8');
        for (const [, key] of source.matchAll(/(?:\.T "|(?:t|errorText|responseError)\(')([a-zA-Z]+\.[a-zA-Z0-9]+)['"]/g)) {
            assert.ok(english[key], `${file}: missing ${key}`);
        }
        if (file.endsWith('.js')) {
            const sinkLiteral = /(?:textContent\s*=|alert\s*\(|showMessage\([^,\n]+,)\s*(['"`])([^\n]*?)\1/g;
            for (const [, , value] of source.matchAll(sinkLiteral)) {
                const plain = value.replace(/\$\{[^}]*\}/g, '');
                assert.ok(!/[a-zA-Z]/.test(plain), `${file}: hardcoded UI literal ${plain}`);
            }
        }
        if (!file.endsWith('.html')) continue;
        const dom = new JSDOM(source.replace(/\{\{\.T "[^"]+"\}\}/g, 'TRANSLATED')
            .replace(/\{\{[\s\S]*?\}\}/g, ''));
        function inspect(node) {
            if (node.nodeType === 3) {
                const text = node.textContent.trim();
                assert.ok(!/[a-zA-Z]/.test(text) || /^(TRANSLATED|ExpenseOwl|GitHub|v1\.1)$/.test(text),
                    `${file}: hardcoded text ${text}`);
            }
            if (node.nodeType === 1) {
                for (const attr of attributes) {
                    const text = node.getAttribute(attr);
                    assert.ok(!text || !/[a-zA-Z]/.test(text) || text === 'TRANSLATED',
                        `${file}: hardcoded ${attr} ${text}`);
                }
                if (node.tagName === 'TEMPLATE') inspect(node.content);
            }
            for (const child of node.childNodes) inspect(child);
        }
        inspect(dom.window.document);
        dom.window.close();
    }
});

test('all language metadata uses valid Intl locales', async () => {
    for (const file of await fs.readdir(locales)) {
        if (!file.endsWith('.json')) continue;
        const catalog = JSON.parse(await fs.readFile(path.join(locales, file), 'utf8'));
        assert.equal(catalog.code, file.slice(0, -5));
        assert.ok(catalog.name);
        assert.doesNotThrow(() => new Intl.DateTimeFormat(catalog.locale));
        assert.doesNotThrow(() => new Intl.PluralRules(catalog.locale));
    }
});
