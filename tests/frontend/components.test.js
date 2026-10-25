import assert from 'node:assert/strict';
import test from 'node:test';
import { browser } from './helpers.js';

test('date and currency helpers preserve boundaries, sorting and currencies', async t => {
    const app = await browser([]);
    t.after(app.close);
    const dates = await app.import('shared/dates.js');
    const currency = await app.import('shared/currency.js');
    const now = new app.window.Date(2026, 9, 10, 12);
    const expenses = [
        { id: 'past', date: new app.window.Date(2026, 9, 9).toISOString() },
        { id: 'today', date: new app.window.Date(2026, 9, 10, 23, 59, 59, 999).toISOString() },
        { id: 'future', date: new app.window.Date(2026, 9, 11).toISOString() },
    ];
    for (const range of ['month', 'year', 'all']) {
        assert.deepEqual(Array.from(dates.getExpenses(expenses, range, false, now, 1, now), e => e.id), ['today', 'past']);
        assert.equal(dates.getExpenses(expenses, range, true, now, 1, now).length, 3);
    }
    assert.equal(expenses[0].id, 'past');
    const bounds = dates.getMonthBounds(now, 5);
    assert.equal(bounds.start.getDate(), 5);
    assert.equal(bounds.end.getDate(), 4);
    assert.equal(bounds.end.getMonth(), 10);
    assert.equal(currency.formatCurrency(-12.5, 'usd'), '-$12.50');
    assert.equal(currency.formatCurrency(12.5, 'eur'), '€12,50');
    assert.equal(currency.formatCurrency(12.5, 'jpy'), '¥13');
});

test('controls apply all future settings combinations and notify only once', async t => {
    const app = await browser(['components/transaction-controls/transaction-controls.html']);
    t.after(app.close);
    const { createTransactionControls } = await app.import('components/transaction-controls/transaction-controls.js');
    let changes = 0;
    const controls = createTransactionControls(() => changes++);
    const toggle = app.document.getElementById('includeFutureToggle');
    for (const show of [false, true]) {
        for (const include of [false, true]) {
            const nextApp = await browser(['components/transaction-controls/transaction-controls.html']);
            const module = await nextApp.import('components/transaction-controls/transaction-controls.js');
            const next = module.createTransactionControls(() => {});
            next.applyConfig({ startDate: 1, showFutureTransactions: show, includeFutureTransactions: include });
            assert.equal(nextApp.document.querySelector('.transaction-visibility').hidden, !show);
            assert.equal(next.state.includeFuture, include);
            nextApp.close();
        }
    }
    controls.applyConfig({ startDate: 1, showFutureTransactions: true, includeFutureTransactions: true });
    toggle.click();
    controls.applyConfig({ startDate: 1, showFutureTransactions: true, includeFutureTransactions: true });
    assert.equal(toggle.checked, false);
    assert.equal(changes, 1);
});

test('filtered table actions use IDs and preserve input focus during body refresh', async t => {
    const app = await browser(['shared/layout.html', 'components/transaction-table/transaction-table.html']);
    t.after(app.close);
    const { createTransactionTable } = await app.import('components/transaction-table/transaction-table.js');
    let edited;
    const table = createTransactionTable({ onEdit: id => { edited = id; }, onDeleted: () => {} });
    const expenses = [
        { id: 'hidden', name: 'Rent', category: 'Housing', amount: -100, date: '2026-10-10T12:00:00Z' },
        { id: 'target', name: 'Coffee <script>', category: 'Food', amount: -5, date: '2026-10-09T12:00:00Z', tags: ['work'] },
    ];
    table.render(expenses, { currency: 'usd', timeRange: 'all', futureMessage: '' });
    const input = app.document.getElementById('filter-name');
    input.focus();
    input.value = 'Coffee';
    input.dispatchEvent(new app.window.Event('input'));
    app.document.querySelector('[data-edit]').click();
    assert.equal(edited, 'target');
    assert.equal(app.document.activeElement, input);
    assert.equal(app.document.querySelectorAll('tbody tr').length, 1);
    assert.equal(app.document.querySelector('[data-name]').textContent, 'Coffee <script>');
    assert.equal(app.document.querySelector('[data-name] script'), null);
    input.value = 'missing';
    input.dispatchEvent(new app.window.Event('input'));
    assert.match(app.document.querySelector('tbody').textContent, /No transactions/);
});

test('tags initialize once and destroy their listeners', async t => {
    const app = await browser(['components/expense-form/expense-form.html', 'components/tags-input/tags-input.html']);
    t.after(app.close);
    const { createTagInput } = await app.import('components/tags-input/tags-input.js');
    const input = app.document.getElementById('tags-input');
    const tags = createTagInput({
        input,
        selectedContainer: app.document.getElementById('selected-tags'),
        dropdown: app.document.getElementById('tags-dropdown'),
        getAvailableTags: () => new Set(['work']),
    });
    input.value = 'home';
    input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter' }));
    assert.deepEqual(Array.from(tags.getTags()), ['home']);
    tags.render();
    tags.render();
    app.document.querySelector('.remove-tag').click();
    assert.equal(tags.getTags().length, 0);
    tags.destroy();
    input.value = 'ignored';
    input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter' }));
    assert.equal(tags.getTags().length, 0);
});

    test('main multiselect filters retain exact category and any-tag matches after extraction', async t => {
        const app = await browser(['shared/layout.html', 'components/transaction-table/transaction-table.html']);
        t.after(app.close);
        const { createTransactionTable } = await app.import('components/transaction-table/transaction-table.js');
        let edited;
        let deleted;
        app.window.fetch = async url => { deleted = url; return { ok: true }; };
        const table = createTransactionTable({ onEdit: id => { edited = id; }, onDeleted: () => {} });
        const expenses = [
            { id: 'one', name: 'Coffee', category: 'Food', amount: -5, tags: ['work'], date: '2026-10-09T12:00:00Z' },
            { id: 'two', name: 'Lunch', category: 'Food delivery', amount: -10, tags: ['home'], date: '2026-10-09T12:00:00Z' },
            { id: 'three', name: 'Snack', category: 'Food', amount: -2, tags: ['home', '<b>tag</b>'], date: '2026-10-09T12:00:00Z' },
        ];
        const options = { currency: 'usd', timeRange: 'all', futureMessage: '' };
        const select = (key, value) => {
            const checkbox = [...app.document.querySelectorAll(`[data-multiselect="${key}"] input`)]
                .find(input => input.value === value);
            checkbox.click();
        };
        const ids = () => [...app.document.querySelectorAll('tbody [data-expense-id]')].map(row => row.dataset.expenseId);
        table.render(expenses, options);
        const button = app.document.getElementById('filter-category-display');
        button.click();
        assert.equal(app.document.getElementById('filter-category-dropdown').hidden, false);
        select('category', 'Food');
        assert.deepEqual(ids(), ['one', 'three']);
        assert.equal(app.document.getElementById('filter-category-dropdown').hidden, false);
        select('tags', 'home');
        assert.deepEqual(ids(), ['three']);
        app.document.querySelector('[data-edit]').click();
        assert.equal(edited, 'three');
        const event = new app.window.MouseEvent('click', { shiftKey: true });
        app.document.querySelector('[data-delete]').dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(deleted, '/expense/delete?id=three');
        select('tags', 'work');
        assert.deepEqual(ids(), ['one', 'three']);
        select('category', 'Food delivery');
        assert.deepEqual(ids(), ['one', 'two', 'three']);
        assert.equal(app.document.querySelector('.multiselect-option b'), null);
        app.document.body.click();
        assert.equal(app.document.getElementById('filter-category-dropdown').hidden, true);
        assert.equal(button.getAttribute('aria-expanded'), 'false');
        table.render([expenses[1]], options);
        select('tags', 'home');
        assert.match(app.document.querySelector('tbody').textContent, /No transactions/);
        assert.ok(app.document.getElementById('filter-tags-display'));
        table.clearFilters();
        table.render(expenses, options);
        assert.equal(app.document.getElementById('filter-category-display').textContent, 'All categories');
        assert.deepEqual(ids(), ['one', 'two', 'three']);
    });

    test('controls reset restored radio selections to monthly on page creation', async t => {
        const app = await browser(['components/transaction-controls/transaction-controls.html']);
        t.after(app.close);
        app.document.getElementById('showAllToggle').checked = true;
        const { createTransactionControls } = await app.import('components/transaction-controls/transaction-controls.js');
        const controls = createTransactionControls(() => {});
        assert.equal(controls.state.timeRange, 'month');
        assert.equal(app.document.getElementById('showMonthToggle').checked, true);
        assert.equal(app.document.getElementById('showAllToggle').checked, false);
        assert.equal(app.document.getElementById('month-navigation').style.display, 'flex');
        assert.equal(app.document.getElementById('year-navigation').style.display, 'none');
    });

test('expense form submits the selected stable ID and preserves gain/tags/date', async t => {
    const app = await browser(['shared/layout.html', 'components/expense-form/expense-form.html', 'components/tags-input/tags-input.html']);
    t.after(app.close);
    app.window.HTMLElement.prototype.scrollIntoView = () => {};
    const { createExpenseForm } = await app.import('components/expense-form/expense-form.js');
    let request;
    let resolveSaved;
    const saved = new Promise(resolve => { resolveSaved = resolve; });
    app.window.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true };
    };
    const form = createExpenseForm({
        getCategories: () => ['Food', 'Income'],
        getTags: () => ['work'],
        onSaved: () => resolveSaved(),
    });
    form.refresh({ categories: ['Food', 'Income'] });
    form.edit({ id: 'target', name: 'Salary', category: 'Income', amount: 25, date: '2026-10-10T12:00:00Z', tags: ['work'] });
    assert.equal(app.document.getElementById('reportGain').checked, true);
    app.document.getElementById('expenseForm').dispatchEvent(new app.window.Event('submit', { cancelable: true }));
    await saved;
    assert.equal(request.url, '/expense/edit?id=target');
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.amount, 25);
    assert.equal(payload.category, 'Income');
    assert.deepEqual(payload.tags, ['work']);
    assert.equal(app.document.getElementById('expenseForm').dataset.editId, undefined);
    assert.match(app.document.getElementById('formMessage').textContent, /updated successfully/);
});
