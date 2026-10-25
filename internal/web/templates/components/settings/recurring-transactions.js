import { formatCurrency } from '/shared/currency.js';
import { cloneTemplate, populateOptions } from '/shared/dom.js';
import { getISODateWithLocalTime, localDateInput } from '/shared/dates.js';
import { showMessage } from '/shared/messages.js';
import { createTagInput } from '/components/tags-input/tags-input.js';

export function createSettingsRecurringTransactions({
    categories = [],
    currency = 'usd',
    allTags = new Set(),
    recurringExpenses = [],
    onRecurringExpensesChange = () => {}
} = {}) {
    let currentCategories = [...categories];
    let currentCurrency = currency;
    let expenses = [...recurringExpenses];
    let expenseToDelete = null;
    let expenseToEdit = null;
    const selectedTags = new Set();
    const editSelectedTags = new Set();
    const list = document.getElementById('recurring-expenses-list');
    const addTagInput = createTagInput({
        input: document.getElementById('tags-input'),
        selectedContainer: document.getElementById('selected-tags'),
        dropdown: document.getElementById('tags-dropdown'),
        getAvailableTags: () => allTags,
        selectedTags,
        normalize: tag => tag.trim().replace(/[<>]/g, ' ').trim()
    });
    const editTagInput = createTagInput({
        input: document.getElementById('edit-tags-input'),
        selectedContainer: document.getElementById('edit-selected-tags'),
        dropdown: document.getElementById('edit-tags-dropdown'),
        getAvailableTags: () => allTags,
        selectedTags: editSelectedTags,
        normalize: tag => tag.trim().replace(/[<>]/g, ' ').trim()
    });

    function updateCategories(nextCategories) {
        currentCategories = [...nextCategories];
        populateOptions(document.getElementById('recurringCategory'), currentCategories);
        populateOptions(document.getElementById('editRecurringCategory'), currentCategories);
    }

    function findNextOccurrence(expense) {
        const nextDate = new Date(expense.startDate);
        const today = new Date();
        if (nextDate >= today) return nextDate.toLocaleDateString();
        if (expense.occurrences > 0) {
            let occurrencesCount = 0;
            while (nextDate < today) {
                occurrencesCount++;
                if (occurrencesCount >= expense.occurrences) return 'Finished';
                advanceDate(nextDate, expense.interval);
            }
            return nextDate.toLocaleDateString();
        }
        while (nextDate < today) advanceDate(nextDate, expense.interval);
        return nextDate.toLocaleDateString();
    }

    function advanceDate(date, interval) {
        switch (interval) {
            case 'daily': date.setDate(date.getDate() + 1); break;
            case 'weekly': date.setDate(date.getDate() + 7); break;
            case 'monthly': date.setMonth(date.getMonth() + 1); break;
            case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
        }
    }

    function render() {
        if (!expenses.length) {
            list.replaceChildren(cloneTemplate('recurring-empty-template'));
            return;
        }
        const table = cloneTemplate('recurring-table-template');
        const body = table.querySelector('tbody');
        expenses.forEach(expense => {
            const row = cloneTemplate('recurring-row-template');
            row.dataset.id = expense.id;
            row.querySelector('[data-field="name"]').textContent = expense.name;
            row.querySelector('[data-field="amount"]').textContent = formatCurrency(expense.amount, currentCurrency);
            row.querySelector('[data-field="category"]').textContent = expense.category;
            row.querySelector('[data-field="interval"]').textContent = `${expense.interval.charAt(0).toUpperCase()}${expense.interval.slice(1)}`;
            row.querySelector('[data-field="next-occurrence"]').textContent = findNextOccurrence(expense);
            row.querySelector('[data-action="edit-recurring"]').dataset.id = expense.id;
            row.querySelector('[data-action="show-delete"]').dataset.id = expense.id;
            body.appendChild(row);
        });
        list.replaceChildren(table);
    }

    async function fetchAndRender() {
        try {
            const response = await fetch('/recurring-expenses');
            if (!response.ok) throw new Error('Failed to fetch recurring expenses');
            const result = await response.json();
            expenses = Array.isArray(result) ? result : [];
            onRecurringExpensesChange([...expenses]);
            render();
        } catch (error) {
            console.error('Error fetching recurring expenses:', error);
            list.replaceChildren(cloneTemplate('recurring-error-template'));
        }
    }

    function closeDeleteModal() {
        expenseToDelete = null;
        document.getElementById('deleteRecurringModal').classList.remove('active');
    }

    function openDeleteModal(id) {
        expenseToDelete = id;
        document.getElementById('deleteRecurringModal').classList.add('active');
    }

    async function confirmDelete(removeAll) {
        if (!expenseToDelete) return;
        try {
            const response = await fetch(`/recurring-expense/delete?id=${encodeURIComponent(expenseToDelete)}&removeAll=${removeAll}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete recurring expense');
            showMessage('recurringExpenseMessage', 'Recurring expense deleted successfully', true);
            await fetchAndRender();
        } catch (error) {
            console.error('Error deleting recurring expense:', error);
            showMessage('recurringExpenseMessage', 'Failed to delete recurring expense', false);
        } finally {
            closeDeleteModal();
        }
    }

    function openEditModal(id) {
        expenseToEdit = expenses.find(expense => String(expense.id) === String(id));
        if (!expenseToEdit) return;
        document.getElementById('editRecurringName').value = expenseToEdit.name;
        document.getElementById('editRecurringAmount').value = Math.abs(expenseToEdit.amount);
        document.getElementById('editRecurringReportGain').checked = expenseToEdit.amount > 0;
        document.getElementById('editRecurringCategory').value = expenseToEdit.category;
        document.getElementById('editRecurringInterval').value = expenseToEdit.interval;
        document.getElementById('editRecurringStartDate').value = new Date(expenseToEdit.startDate).toISOString().slice(0, 10);
        document.getElementById('editRecurringOccurrences').value = expenseToEdit.occurrences;
        editSelectedTags.clear();
        (expenseToEdit.tags || []).forEach(tag => editSelectedTags.add(tag));
        editTagInput.render();
        document.getElementById('editRecurringModal').classList.add('active');
    }

    function closeEditModal() {
        expenseToEdit = null;
        document.getElementById('editRecurringModal').classList.remove('active');
    }

    async function confirmUpdate(updateAll) {
        if (!expenseToEdit) return;
        let amount = parseFloat(document.getElementById('editRecurringAmount').value);
        if (!document.getElementById('editRecurringReportGain').checked) amount *= -1;
        const updatedData = {
            ...expenseToEdit,
            name: document.getElementById('editRecurringName').value,
            amount,
            category: document.getElementById('editRecurringCategory').value,
            tags: editTagInput.getTags(),
            interval: document.getElementById('editRecurringInterval').value,
            startDate: getISODateWithLocalTime(document.getElementById('editRecurringStartDate').value),
            occurrences: parseInt(document.getElementById('editRecurringOccurrences').value, 10)
        };
        try {
            const response = await fetch(`/recurring-expense/edit?id=${encodeURIComponent(expenseToEdit.id)}&updateAll=${updateAll}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            if (!response.ok) throw new Error('Failed to update recurring expense');
            showMessage('recurringExpenseMessage', 'Recurring expense updated successfully', true);
            await fetchAndRender();
        } catch (error) {
            console.error('Error updating recurring expense:', error);
            showMessage('recurringExpenseMessage', 'Failed to update recurring expense', false);
        } finally {
            closeEditModal();
        }
    }

    document.getElementById('recurringStartDate').value = localDateInput();
    document.getElementById('recurringExpenseForm').addEventListener('submit', async event => {
        event.preventDefault();
        let amount = parseFloat(document.getElementById('recurringAmount').value);
        if (!document.getElementById('recurringReportGain').checked) amount *= -1;
        const formData = {
            name: document.getElementById('recurringName').value,
            amount,
            category: document.getElementById('recurringCategory').value,
            tags: addTagInput.getTags(),
            interval: document.getElementById('recurringInterval').value,
            startDate: getISODateWithLocalTime(document.getElementById('recurringStartDate').value),
            occurrences: parseInt(document.getElementById('recurringOccurrences').value, 10)
        };
        try {
            const response = await fetch('/recurring-expense', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (response.ok) {
                showMessage('recurringExpenseMessage', 'Recurring expense added successfully!', true);
                document.getElementById('recurringExpenseForm').reset();
                addTagInput.clear();
                document.getElementById('recurringStartDate').value = localDateInput();
                formData.tags.forEach(tag => allTags.add(tag));
                await fetchAndRender();
            } else {
                const error = await response.json();
                showMessage('recurringExpenseMessage', `Error: ${error.error || 'Failed to add recurring expense'}`, false);
            }
        } catch (error) {
            console.error('Error adding recurring expense:', error);
            showMessage('recurringExpenseMessage', 'Error: Failed to add recurring expense', false);
        }
    });

    document.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        const button = event.target.closest('[data-action]');
        if (!button) return;
        switch (action) {
            case 'edit-recurring':
                openEditModal(button.dataset.id);
                break;
            case 'show-delete':
                openDeleteModal(button.dataset.id);
                break;
            case 'close-delete':
                closeDeleteModal();
                break;
            case 'delete-recurring':
                confirmDelete(button.dataset.removeAll === 'true');
                break;
            case 'close-edit':
                closeEditModal();
                break;
            case 'update-recurring':
                confirmUpdate(button.dataset.updateAll === 'true');
                break;
        }
    });

    updateCategories(currentCategories);
    addTagInput.render();
    render();

    return {
        updateCategories,
        refresh({
            categories: nextCategories = currentCategories,
            currency: nextCurrency = currentCurrency,
            recurringExpenses: nextExpenses = expenses,
            allTags: nextTags = allTags
        } = {}) {
            currentCategories = [...nextCategories];
            currentCurrency = nextCurrency;
            expenses = [...nextExpenses];
            allTags = nextTags;
            updateCategories(currentCategories);
            addTagInput.render();
            editTagInput.render();
            render();
        },
        setCurrency(nextCurrency) {
            currentCurrency = nextCurrency;
            render();
        },
        destroy() {
            addTagInput.destroy();
            editTagInput.destroy();
        }
    };
}
