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
