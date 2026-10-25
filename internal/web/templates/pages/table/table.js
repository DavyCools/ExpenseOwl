import { initI18n, t } from '/shared/i18n.js';
import { createTransactionControls } from '../../components/transaction-controls/transaction-controls.js';
import { createExpenseForm } from '../../components/expense-form/expense-form.js';
import { createTransactionTable } from '../../components/transaction-table/transaction-table.js';

await initI18n();

let config = null;
let allExpenses = [];
let allTags = new Set();
const controls = createTransactionControls(({ periodChanged }) => {
    if (periodChanged) table.clearFilters();
    render();
});
const form = createExpenseForm({
    getCategories: () => config.categories,
    getTags: () => allTags,
    onSaved: initialize,
});
const table = createTransactionTable({
    onEdit(id) {
        const expense = allExpenses.find(item => item.id === id);
        if (!expense) {
            console.error('Failed to load expense for editing:', id);
            alert(t('expense.editFailed'));
            return;
        }
        form.edit(expense);
    },
    onDeleted: initialize,
});
function render() {
    if (!config) return;
    table.render(controls.getExpenses(allExpenses), {
        currency: config.currency,
        timeRange: controls.state.timeRange,
        futureMessage: controls.futureMessage(),
    });
}
async function initialize() {
    try {
        const configResponse = await fetch('/config');
        if (!configResponse.ok) throw new Error('Failed to fetch configuration');
        config = await configResponse.json();
        controls.applyConfig(config);
        const response = await fetch('/expenses');
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        allExpenses = Array.isArray(data) ? data : (data && Array.isArray(data.expenses) ? data.expenses : []);
        allTags = new Set(allExpenses.flatMap(expense => expense.tags || []));
        form.refresh(config);
        render();
    } catch (error) {
        console.error('Failed to initialize table:', error);
        table.showError(t('expense.loadFailed'));
    }
}
initialize();
