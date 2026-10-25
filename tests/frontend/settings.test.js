import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { browser, templates, locales } from './helpers.js';

const settingsFragments = [
    'shared/layout.html',
    'components/tags-input/tags-input.html',
    'components/settings/categories.html',
    'components/settings/preferences.html',
    'components/settings/import-export.html',
    'components/settings/recurring-transactions.html',
];

const config = {
    categories: ['Food', 'Income'],
    currency: 'eur',
    startDate: 5,
    showFutureTransactions: false,
    includeFutureTransactions: true,
};
const recurringExpense = {
    id: 'stable-id',
    name: 'Salary <script>',
    amount: 25,
    category: 'Income',
    interval: 'monthly',
    startDate: '2099-10-10T12:00:00Z',
    occurrences: 2,
    tags: ['work'],
};
const settled = () => new Promise(resolve => setImmediate(resolve));
const values = select => Array.from(select.options, option => option.value);

async function createSettingsBrowser(t) {
    const app = await browser(settingsFragments);
    t.after(app.close);
    return app;
}

test('settings composition preserves original paired rows and section ordering', async t => {
    const app = await browser([]);
    t.after(app.close);
    const sources = await Promise.all([
        'pages/settings/settings.html',
        ...settingsFragments,
    ].map(file => fs.readFile(path.join(templates, file), 'utf8')));
    const definitions = new Map(sources.flatMap(source => Array.from(
        source.matchAll(/\{\{define "([^"]+)"\}\}([\s\S]*?)\{\{end\}\}/g),
        match => [match[1], match[2]]
    )));
    function compose(name) {
        return (definitions.get(name) || '').replace(
            /\{\{template "([^"]+)" [^}]+\}\}/g, (_, child) => compose(child)
        );
    }
    const catalog = JSON.parse(await fs.readFile(path.join(locales, 'en.json'), 'utf8'));
    const rendered = compose('page-settings').replace(/\{\{\.T "([^"]+)"\}\}/g, (_, key) => catalog.translation[key]);
    const document = new app.window.DOMParser().parseFromString(rendered, 'text/html');
    assert.deepEqual(Array.from(document.querySelectorAll('h2'), heading => heading.textContent), [
        'Category Settings',
        'Currency Settings',
        'Start Date Settings',
        'Theme Settings',
        'Import/Export Data',
        'Language',
        'Future Transactions',
        'Recurring Transactions',
    ]);
    const rows = document.querySelectorAll('.container > .settings-container');
    assert.equal(rows.length, 3);
    assert.deepEqual(Array.from(rows, row => Array.from(
        row.querySelectorAll(':scope > .form-container.half-width h2'), heading => heading.textContent
    )), [['Currency Settings', 'Start Date Settings'], ['Theme Settings', 'Import/Export Data'], ['Language', 'Future Transactions']]);
    const future = document.getElementById('showFutureTransactions').closest('.form-container');
    assert.equal(future.classList.contains('half-width'), true);
    assert.equal(future.parentElement, document.getElementById('languageSelect').closest('.form-container').parentElement);
    assert.equal(future.parentElement.className, 'settings-container');
});

test('recurring contract updates both category selects after add, rename, reorder and delete', async t => {
    const app = await createSettingsBrowser(t);
    const { createSettingsCategories } = await app.import('components/settings/categories.js');
    const { createSettingsRecurringTransactions } = await app.import('components/settings/recurring-transactions.js');
    const requests = [];
    app.window.fetch = async (url, options) => {
        requests.push({ url, options });
        return { ok: true };
    };
    const recurring = createSettingsRecurringTransactions({
        categories: config.categories,
        recurringExpenses: [recurringExpense],
    });
    for (const method of ['updateCategories', 'refresh', 'setCurrency', 'destroy']) {
        assert.equal(typeof recurring[method], 'function', method);
    }
    const categories = createSettingsCategories({
        categories: config.categories,
        onChange: nextCategories => recurring.updateCategories(nextCategories),
    });
    app.document.getElementById('recurringCategory').value = 'Income';
    app.document.getElementById('newCategory').value = 'Travel';
    app.document.getElementById('addCategory').click();
    assert.deepEqual(Array.from(categories.getCategories()), ['Food', 'Income', 'Travel']);
    assert.equal(app.document.getElementById('recurringCategory').value, 'Income');

    const food = app.document.querySelector('.category-item[data-index="0"]');
    food.querySelector('[data-action="rename"]').click();
    const input = food.querySelector('.category-rename-input');
    assert.equal(input.hidden, false);
    input.value = 'Meals';
    food.querySelector('[data-action="save-rename"]').click();
    await settled();
    assert.equal(requests[0].url, '/categories/rename');
    assert.deepEqual(JSON.parse(requests[0].options.body), { oldName: 'Food', newName: 'Meals' });

    const source = app.document.querySelector('.category-item[data-index="2"]');
    const target = app.document.querySelector('.category-item[data-index="0"]');
    target.getBoundingClientRect = () => ({ top: 10, height: 20 });
    const start = new app.window.Event('dragstart', { bubbles: true });
    Object.defineProperty(start, 'dataTransfer', { value: { setData() {}, effectAllowed: '' } });
    source.dispatchEvent(start);
    target.dispatchEvent(new app.window.MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 11 }));
    assert.ok(app.document.querySelector('.placeholder'));
    target.dispatchEvent(new app.window.MouseEvent('drop', { bubbles: true, cancelable: true, clientY: 11 }));
    assert.deepEqual(Array.from(categories.getCategories()), ['Travel', 'Meals', 'Income']);
    assert.equal(app.document.querySelector('.placeholder'), null);

    app.document.querySelector('.category-item[data-index="1"] [data-action="delete"]').click();
    for (const id of ['recurringCategory', 'editRecurringCategory']) {
        assert.deepEqual(values(app.document.getElementById(id)), ['Travel', 'Income']);
    }
    app.document.getElementById('saveCategories').click();
    await settled();
    const saved = requests.find(request => request.url === '/categories/edit');
    assert.deepEqual(JSON.parse(saved.options.body), ['Travel', 'Income']);
    recurring.destroy();
});

test('category drag accepts placeholder and flex-list gap targets and saves actual drop order', async t => {
    const app = await createSettingsBrowser(t);
    const { createSettingsCategories } = await app.import('components/settings/categories.js');
    const changes = [];
    const categories = createSettingsCategories({
        categories: ['Food', 'Travel', 'Income'],
        onChange: nextCategories => changes.push(Array.from(nextCategories)),
    });
    const list = app.document.getElementById('categories-list');
    const source = list.querySelector('[data-index="2"]');
    const target = list.querySelector('[data-index="0"]');
    target.getBoundingClientRect = () => ({ top: 10, height: 20 });
    const start = new app.window.Event('dragstart', { bubbles: true });
    Object.defineProperty(start, 'dataTransfer', { value: { setData() {}, effectAllowed: '', dropEffect: '' } });
    source.querySelector('.category-name').dispatchEvent(start);
    const over = new app.window.MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 11 });
    target.querySelector('.category-name').dispatchEvent(over);
    assert.equal(over.defaultPrevented, true);
    const placeholder = list.querySelector('.placeholder');
    assert.ok(placeholder);
    for (const dropTarget of [placeholder, list]) {
        const hover = new app.window.MouseEvent('dragover', { bubbles: true, cancelable: true, clientY: 11 });
        dropTarget.dispatchEvent(hover);
        assert.equal(hover.defaultPrevented, true, 'placeholder and list gaps must remain valid native drop targets');
    }
    const drop = new app.window.MouseEvent('drop', { bubbles: true, cancelable: true, clientY: 11 });
    placeholder.dispatchEvent(drop);
    assert.equal(drop.defaultPrevented, true);
    assert.deepEqual(Array.from(categories.getCategories()), ['Income', 'Food', 'Travel']);
    assert.deepEqual(changes, [['Income', 'Food', 'Travel']]);
    assert.equal(list.querySelector('.placeholder'), null);
    assert.equal(list.querySelector('.dragging, .drag-over'), null);
});

test('recurring edit/delete actions preserve stable IDs, tags, sign and future/all flags', async t => {
    const app = await createSettingsBrowser(t);
    const { createSettingsRecurringTransactions } = await app.import('components/settings/recurring-transactions.js');
    const requests = [];
    app.window.fetch = async (url, options) => {
        requests.push({ url, options });
        return { ok: true, json: async () => [recurringExpense] };
    };
    const recurring = createSettingsRecurringTransactions({
        categories: config.categories,
        currency: 'eur',
        allTags: new Set(['work', 'home']),
        recurringExpenses: [recurringExpense],
    });
    assert.equal(app.document.querySelector('[data-field="name"]').textContent, recurringExpense.name);
    assert.equal(app.document.querySelector('[data-field="name"] script'), null);
    assert.equal(app.document.querySelector('[data-field="amount"]').textContent, '€25,00');
    for (const updateAll of [false, true]) {
        app.document.querySelector('[data-action="edit-recurring"][data-id="stable-id"]').click();
        assert.equal(app.document.getElementById('editRecurringReportGain').checked, true);
        assert.equal(app.document.querySelectorAll('#edit-selected-tags .tag-pill').length, 1);
        assert.equal(app.document.querySelector('#edit-selected-tags [data-tag-name]').textContent, 'work');
        assert.equal(app.document.getElementById('editRecurringStartDate').value, '2099-10-10');
        app.document.querySelector(`[data-action="update-recurring"][data-update-all="${updateAll}"]`).click();
        await settled();
        const request = requests.find(request => request.url === `/recurring-expense/edit?id=stable-id&updateAll=${updateAll}`);
        assert.ok(request);
        const payload = JSON.parse(request.options.body);
        assert.equal(payload.id, 'stable-id');
        assert.equal(payload.amount, 25);
        assert.deepEqual(payload.tags, ['work']);
        assert.equal(app.document.getElementById('editRecurringModal').classList.contains('active'), false);
    }
    for (const removeAll of [false, true]) {
        app.document.querySelector('[data-action="show-delete"][data-id="stable-id"]').click();
        app.document.querySelector(`[data-action="delete-recurring"][data-remove-all="${removeAll}"]`).click();
        await settled();
        const request = requests.find(request => request.url === `/recurring-expense/delete?id=stable-id&removeAll=${removeAll}`);
        assert.equal(request.options.method, 'DELETE');
        assert.equal(app.document.getElementById('deleteRecurringModal').classList.contains('active'), false);
    }
    recurring.destroy();
});

test('recurring creation normalizes tags, submits gain/date and clears only add selection', async t => {
    const app = await createSettingsBrowser(t);
    const { createSettingsRecurringTransactions } = await app.import('components/settings/recurring-transactions.js');
    let payload;
    const recurring = createSettingsRecurringTransactions({ categories: config.categories, allTags: new Set(['work']) });
    app.window.fetch = async (url, options) => {
        if (url === '/recurring-expense') payload = JSON.parse(options.body);
        return { ok: true, json: async () => [] };
    };
    const input = app.document.getElementById('tags-input');
    input.value = '<home>';
    input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter' }));
    assert.equal(app.document.querySelector('#selected-tags [data-tag-name]').textContent, 'home');
    recurring.refresh({ allTags: new Set(['work', 'other']) });
    assert.equal(app.document.querySelectorAll('#selected-tags .tag-pill').length, 1);
    app.document.getElementById('recurringName').value = 'Bonus';
    app.document.getElementById('recurringAmount').value = '15';
    app.document.getElementById('recurringReportGain').checked = true;
    app.document.getElementById('recurringStartDate').value = '2099-10-10';
    app.document.getElementById('recurringExpenseForm').dispatchEvent(new app.window.Event('submit', { cancelable: true }));
    await settled();
    assert.equal(payload.amount, 15);
    assert.deepEqual(payload.tags, ['home']);
    assert.equal(new app.window.Date(payload.startDate).getFullYear(), 2099);
    assert.equal(app.document.querySelectorAll('#selected-tags .tag-pill').length, 0);
    assert.match(app.document.getElementById('recurringStartDate').value, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(app.document.getElementById('recurring-expenses-list').textContent, /No recurring expenses/);
    recurring.destroy();
});

test('preferences preserve future keys, currency callback, start date and theme', async t => {
    const app = await createSettingsBrowser(t);
    const { createSettingsPreferences } = await app.import('components/settings/preferences.js');
    const requests = [];
    let currency;
    app.window.fetch = async (url, options) => {
        if (url === '/locales/') return { ok: true, json: async () => [{ code: 'en', name: 'English' }, { code: 'nl', name: 'Nederlands' }] };
        requests.push({ url, options });
        return { ok: true };
    };
    const preferences = createSettingsPreferences(config, { onCurrencyChange: value => { currency = value; } });
    assert.equal(typeof preferences.updateConfig, 'function');
    assert.equal(preferences.getCurrency(), 'eur');
    assert.equal(preferences.getStartDate(), 5);
    app.document.getElementById('saveFutureTransactionsSettings').click();
    await settled();
    assert.deepEqual(JSON.parse(requests[0].options.body), {
        showFutureTransactions: false,
        includeFutureTransactions: true,
    });
    app.document.getElementById('currencySelect').value = 'usd';
    app.document.getElementById('saveCurrency').click();
    app.document.getElementById('startDate').value = '7';
    app.document.getElementById('saveStartDate').click();
    await settled();
    assert.equal(currency, 'usd');
    assert.equal(preferences.getStartDate(), 7);
    app.document.getElementById('themeSelect').value = 'dark';
    app.document.getElementById('themeSelect').dispatchEvent(new app.window.Event('change'));
    assert.equal(app.window.localStorage.getItem('theme'), 'dark');
    assert.equal(app.document.documentElement.getAttribute('data-theme'), 'dark');
});

test('page initializes, wires category updates and refreshes once after CSV import', async t => {
    const app = await createSettingsBrowser(t);
    const requests = [];
    app.window.fetch = async (url, options) => {
        requests.push({ url, options });
        const data = {
            '/locales/': [{ code: 'en', name: 'English' }, { code: 'nl', name: 'Nederlands' }],
            '/config': config,
            '/expenses': [{ tags: ['personal'] }],
            '/recurring-expenses': [recurringExpense],
            '/import/csv': { total_processed: 2, imported: 1, skipped: 1, new_categories: ['Travel'] },
        };
        return { ok: true, json: async () => data[url], text: async () => 'v4.7' };
    };
    await app.import('pages/settings/settings.js');
    await settled();
    app.document.getElementById('newCategory').value = 'Travel';
    app.document.getElementById('addCategory').click();
    assert.deepEqual(values(app.document.getElementById('recurringCategory')), ['Food', 'Income', 'Travel']);
    const input = app.document.getElementById('csv-import-file');
    Object.defineProperty(input, 'files', { value: [new app.window.File(['name,amount\nCoffee,-5'], 'expenses.csv')] });
    input.dispatchEvent(new app.window.Event('change'));
    await settled();
    assert.equal(app.document.getElementById('summary-imported').textContent, '1');
    assert.equal(app.document.getElementById('importSummary').hidden, false);
    assert.equal(requests.filter(request => request.url === '/config').length, 2);
    app.document.getElementById('newCategory').value = 'After import';
    app.document.getElementById('addCategory').click();
    assert.equal(app.document.querySelectorAll('.category-item').length, 3);
    assert.deepEqual(values(app.document.getElementById('editRecurringCategory')), ['Food', 'Income', 'After import']);
});
