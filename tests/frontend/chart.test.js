import assert from 'node:assert/strict';
import test from 'node:test';
import { browser } from './helpers.js';

test('chart, legend and cashflow share the supplied transaction selection', async t => {
    const app = await browser(['components/chart/chart.html']);
    t.after(app.close);
    let destroyed = 0;
    app.window.Chart = class {
        static defaults = { font: {} };
        constructor(_, config) { this.config = config; }
        destroy() { destroyed++; }
    };
    const { createChart } = await app.import('components/chart/chart.js');
    const chart = createChart();
    const expenses = [
        { id: 'expense', name: 'Coffee', category: 'Food', amount: -5, tags: ['work'] },
        { id: 'income', name: 'Salary', category: 'Income', amount: 20 },
    ];
    chart.render({ expenses, categories: ['Food', 'Income'], currency: 'usd', futureMessage: '' });
    assert.equal(app.document.getElementById('cashflow-expenses').textContent, '$5.00');
    assert.equal(app.document.getElementById('cashflow-income').textContent, '$20.00');
    assert.equal(app.document.getElementById('cashflow-balance').textContent, '$15.00');
    assert.match(app.document.getElementById('customLegend').textContent, /work/);
    chart.render({ expenses: [expenses[1]], categories: ['Food', 'Income'], currency: 'usd', futureMessage: '' });
    assert.equal(app.document.getElementById('cashflow-expenses').textContent, '$0.00');
    assert.equal(app.document.getElementById('cashflow-income').textContent, '$20.00');
    assert.equal(app.document.getElementById('cashflow-section').hidden, false);
    assert.equal(destroyed, 1);
    chart.destroy();
});

for (const language of ['en', 'nl']) {
test(`${language}: main chart behavior survives localization: gains, net slices, tags and disabled categories`, async t => {
    const app = await browser(['components/chart/chart.html'], language);
    t.after(app.close);
    let config;
    app.window.Chart = class {
        static defaults = { font: {} };
        constructor(_, next) { config = next; }
        destroy() {}
    };
    const { createChart } = await app.import('components/chart/chart.js');
    const chart = createChart();
    t.after(() => chart.destroy());
    const transactions = [
        { category: 'Fitness', amount: -55 },
        { category: 'Health', amount: -119, tags: ['Dentist'] },
        { category: 'Health', amount: 78, tags: ['Dentist', 'Refund'] },
        { category: 'Social security', amount: -22.52, tags: ['Union'] },
    ];
    const render = expenses => chart.render({
        expenses, categories: ['Health', 'Fitness', 'Social security', 'Salary'], currency: 'eur'
    });
    const checkAmount = (row, outgoing, incoming, net, split) => {
        assert.equal(row.querySelector('.legend-outgoing').textContent, outgoing);
        assert.equal(row.querySelector('.legend-incoming').textContent, incoming);
        assert.equal(row.querySelector('.legend-net').textContent, net);
        assert.equal(row.querySelector('.legend-amount-breakdown').hidden, !split);
    };
    const category = name => [...app.document.querySelectorAll('.legend-item')]
        .find(row => row.querySelector('.legend-category').textContent.startsWith(name));
    render(transactions);
    assert.deepEqual(Array.from(config.data.labels), ['Fitness', 'Health', 'Social security']);
    assert.deepEqual(Array.from(config.data.datasets[0].data), [55, 41, 22.52]);
    assert.equal(category('Health').querySelector('.legend-category').textContent, 'Health (60.6%)');
    checkAmount(category('Health'), '€119,00', '€78,00', '€41,00', true);
    const dentist = [...app.document.querySelectorAll('.legend-tag-row')]
        .find(row => row.textContent.includes('Dentist'));
    assert.equal(dentist.querySelector('.legend-tag-name').textContent, '• Dentist (100.0%)');
    checkAmount(dentist, '€119,00', '€78,00', '€41,00', true);
    const refund = [...app.document.querySelectorAll('.legend-tag-row')]
        .find(row => row.textContent.includes('Refund'));
    assert.equal(refund.querySelector('.legend-tag-name').textContent, '• Refund (-190.2%)');
    checkAmount(refund, '€0,00', '€78,00', '-€78,00', false);
    checkAmount(app.document.querySelector('.legend-total'), '€196,52', '€78,00', '€118,52', true);
    category('Health').click();
    assert.equal(category('Health').classList.contains('disabled'), true);
    const disabledTags = category('Health').nextElementSibling;
    assert.equal(disabledTags.classList.contains('disabled'), true);
    assert.equal(disabledTags.querySelector('.legend-tag-name').textContent, '• Dentist');
    assert.equal(disabledTags.querySelector('.amount').textContent, '');
    assert.deepEqual(Array.from(config.data.datasets[0].data), [55, 22.52]);
    checkAmount(app.document.querySelector('.legend-total'), '€77,52', '€0,00', '€77,52', false);
    category('Health').click();
    app.document.querySelector('.legend-tags-toggle input').click();
    assert.equal(app.document.querySelectorAll('.legend-tag-row').length, 0);
    assert.equal(app.window.localStorage.getItem('showTagsInLegend'), '0');
    app.document.querySelector('.legend-tags-toggle input').click();
    assert.equal(app.document.querySelectorAll('.legend-tag-row').length, 3);
    render([{ category: 'Salary', amount: 100, tags: ['Pay'] }]);
    assert.equal(app.document.getElementById('customLegend').hidden, false);
    assert.deepEqual(Array.from(config.data.datasets[0].data), []);
    checkAmount(category('Salary'), '€0,00', '€100,00', '-€100,00', false);
    checkAmount(app.document.querySelector('.legend-total'), '€0,00', '€100,00', '-€100,00', false);
    render([
        { category: 'Health', amount: -78, tags: ['Dentist'] },
        { category: 'Health', amount: 78, tags: ['Dentist'] }
    ]);
    assert.equal(app.document.querySelector('.legend-tag-name').textContent, '• Dentist');
    checkAmount(category('Health'), '€78,00', '€78,00', '€0,00', true);
    assert.doesNotMatch(app.document.getElementById('customLegend').textContent, /NaN|Infinity/);
    render([]);
    assert.equal(app.document.getElementById('noDataMessage').hidden, false);
    assert.equal(app.document.getElementById('customLegend').hidden, true);
});
}
