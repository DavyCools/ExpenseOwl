import '/shared/pwa.js';
import { createTransactionControls } from '/components/transaction-controls/transaction-controls.js';
import { createExpenseForm } from '/components/expense-form/expense-form.js';
import { createChart } from '/components/chart/chart.js';

let config = { categories: [], currency: 'usd' };
let allExpenses = [];
let allTags = new Set();
let applyingConfig = false;
const chart = createChart();
const controls = createTransactionControls(() => {
    if (!applyingConfig) render();
});
const form = createExpenseForm({
    getCategories: () => config.categories,
    getTags: () => allTags,
    getCurrency: () => config.currency,
    onSaved: initialize
});

function render() {
    chart.render({
        expenses: controls.getExpenses(allExpenses),
        categories: [...new Set(allExpenses.map(expense => expense.category))],
        currency: config.currency,
        futureMessage: controls.futureMessage()
    });
}

async function initialize() {
    try {
        const configResponse = await fetch('/config');
        if (!configResponse.ok) throw new Error('Failed to fetch configuration');
        const nextConfig = await configResponse.json();
        const response = await fetch('/expenses');
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        config = nextConfig;
        allExpenses = Array.isArray(data) ? data : (data && Array.isArray(data.expenses) ? data.expenses : []);
        allTags = new Set();
        allExpenses.forEach(expense => {
            if (Array.isArray(expense.tags)) {
                expense.tags.forEach(tag => allTags.add(tag));
            }
        });
        applyingConfig = true;
        try {
            controls.applyConfig(config);
            form.refresh(config, allTags);
        } finally {
            applyingConfig = false;
        }
        render();
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
    }
}

document.getElementById('toggleExpenseFormBtn').addEventListener('click', event => {
    const container = document.getElementById('addExpenseContainer');
    container.hidden = !container.hidden;
    const button = event.currentTarget;
    button.querySelector('i').classList.toggle('fa-plus', container.hidden);
    button.querySelector('i').classList.toggle('fa-times', !container.hidden);
    button.querySelector('span').textContent = container.hidden ? 'Add Expense' : 'Close';
});

initialize();
