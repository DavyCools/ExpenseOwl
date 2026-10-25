import { cloneTemplate } from '../../shared/dom.js';
import { formatCurrency } from '../../shared/currency.js';
import { formatDateFromUTC } from '../../shared/dates.js';
import { filterExpenses } from './filters.js';

export function createTransactionTable({ onEdit, onDeleted }) {
    const container = document.getElementById('tableContainer');
    const modal = document.getElementById('deleteModal');
    let expenses = [];
    let currency = 'usd';
    let hasTags = false;
    let table = null;
    let expenseToDelete = null;
    const filters = { name: '', category: [], tags: [], amount: '', date: '' };
    function closeDropdowns() {
        if (!table) return;
        table.querySelectorAll('.multiselect-dropdown').forEach(dropdown => { dropdown.hidden = true; });
        table.querySelectorAll('.multiselect-display').forEach(button => button.setAttribute('aria-expanded', 'false'));
    }
    document.addEventListener('click', event => {
        if (!event.target.closest('.custom-multiselect')) closeDropdowns();
    });
    function setupMultiselect(control) {
        const key = control.dataset.multiselect;
        const button = control.querySelector('.multiselect-display');
        const dropdown = control.querySelector('.multiselect-dropdown');
        const values = [...new Set(key === 'category' ?
            expenses.map(expense => expense.category).filter(Boolean) :
            expenses.flatMap(expense => expense.tags || []))].sort();
        function updateLabel() {
            const label = filters[key].join(', ');
            button.textContent = label ? (label.length > 20 ? label.slice(0, 17) + '...' : label) :
                (key === 'category' ? 'All categories' : 'All tags');
        }
        values.forEach(value => {
            const option = cloneTemplate('transaction-filter-option-template');
            const input = option.querySelector('input');
            input.value = value;
            input.checked = filters[key].includes(value);
            option.querySelector('span').textContent = value;
            input.addEventListener('change', () => {
                if (input.checked) filters[key].push(value);
                else filters[key] = filters[key].filter(selected => selected !== value);
                updateLabel();
                renderBody();
            });
            dropdown.appendChild(option);
        });
        button.addEventListener('click', () => {
            const open = dropdown.hidden;
            closeDropdowns();
            dropdown.hidden = !open;
            button.setAttribute('aria-expanded', String(open));
        });
        updateLabel();
    }
    function closeDelete() {
        expenseToDelete = null;
        modal.classList.remove('active');
    }
    async function confirmDelete() {
        if (!expenseToDelete) return;
        try {
            const response = await fetch(`/expense/delete?id=${encodeURIComponent(expenseToDelete)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete expense');
            await onDeleted();
            closeDelete();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Failed to delete expense. Please try again.');
        }
    }
    modal.querySelector('[data-cancel-delete]').addEventListener('click', closeDelete);
    modal.querySelector('[data-confirm-delete]').addEventListener('click', confirmDelete);
    modal.addEventListener('click', event => {
        if (event.target === modal) closeDelete();
    });
    function renderBody() {
        const rows = filterExpenses(expenses, filters, currency).map(expense => {
            const row = cloneTemplate('transaction-row-template');
            row.dataset.expenseId = expense.id;
            row.querySelector('[data-name]').textContent = expense.name;
            row.querySelector('[data-category]').textContent = expense.category;
            if (hasTags) row.querySelector('[data-tags]').textContent = (expense.tags || []).join(', ');
            else row.querySelector('[data-tags]').remove();
            row.querySelector('[data-amount]').textContent = formatCurrency(expense.amount, currency);
            row.querySelector('[data-date]').textContent = formatDateFromUTC(expense.date);
            row.querySelector('[data-edit]').addEventListener('click', () => onEdit(expense.id));
            row.querySelector('[data-delete]').addEventListener('click', event => {
                expenseToDelete = expense.id;
                if (event.shiftKey) confirmDelete();
                else modal.classList.add('active');
            });
            return row;
        });
        if (!rows.length) {
            const row = cloneTemplate('transaction-empty-row-template');
            row.firstElementChild.colSpan = hasTags ? 6 : 5;
            rows.push(row);
        }
        table.querySelector('tbody').replaceChildren(...rows);
    }
    return {
        clearFilters() {
            Object.keys(filters).forEach(key => { filters[key] = Array.isArray(filters[key]) ? [] : ''; });
        },
        render(selectedExpenses, options) {
            expenses = selectedExpenses;
            currency = options.currency;
            hasTags = expenses.some(expense => expense.tags && expense.tags.length);
            if (!expenses.length) {
                const message = cloneTemplate('empty-message-template');
                message.textContent = (options.timeRange === 'all' ? 'No transactions found' :
                    'No expenses recorded for this ' + options.timeRange) + options.futureMessage;
                container.replaceChildren(message);
                table = null;
                return;
            }
            table = cloneTemplate('transaction-table-template');
            if (!hasTags) table.querySelectorAll('[data-tags]').forEach(node => node.remove());
            table.querySelectorAll('[data-multiselect]').forEach(setupMultiselect);
            table.querySelectorAll('[data-filter]').forEach(input => {
                input.value = filters[input.dataset.filter];
                input.addEventListener('input', () => {
                    filters[input.dataset.filter] = input.value;
                    renderBody();
                });
            });
            container.replaceChildren(table);
            renderBody();
        },
        showError(message) {
            const node = cloneTemplate('empty-message-template');
            node.textContent = message;
            container.replaceChildren(node);
        },
    };
}
