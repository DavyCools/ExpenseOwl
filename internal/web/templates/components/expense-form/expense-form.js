import { populateOptions } from '../../shared/dom.js';
import { getISODateWithLocalTime, localDateInput } from '../../shared/dates.js';
import { showMessage } from '../../shared/messages.js';
import { createTagInput } from '../tags-input/tags-input.js';

export function createExpenseForm({ getCategories, getTags, onSaved }) {
    const form = document.getElementById('expenseForm');
    const field = id => form.querySelector(`#${id}`);
    const submit = form.querySelector('button[type="submit"]');
    const tags = createTagInput({
        input: field('tags-input'),
        selectedContainer: field('selected-tags'),
        dropdown: field('tags-dropdown'),
        getAvailableTags: getTags,
    });
    field('date').value = localDateInput();
    field('name').addEventListener('click', event => {
        if (event.target.value === '-') event.target.value = '';
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const editId = form.dataset.editId;
        let amount = parseFloat(field('amount').value);
        if (!field('reportGain').checked) amount *= -1;
        const data = {
            name: field('name').value,
            category: field('category').value,
            amount,
            date: getISODateWithLocalTime(field('date').value),
            tags: tags.getTags(),
        };
        try {
            const response = await fetch(editId ? `/expense/edit?id=${encodeURIComponent(editId)}` : '/expense', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                showMessage('formMessage', `Error: ${error.error || 'Failed to save expense'}`, false);
                return;
            }
            showMessage('formMessage', editId ? 'Expense updated successfully!' : 'Expense added successfully!', true);
            form.reset();
            tags.clear();
            delete form.dataset.editId;
            submit.textContent = 'Add Expense';
            await onSaved();
            field('date').value = localDateInput();
        } catch (error) {
            console.error('Error saving expense:', error);
            showMessage('formMessage', 'Error: Failed to save expense', false);
        }
    });
    return {
        refresh(config) { populateOptions(field('category'), config.categories || getCategories()); },
        edit(expense) {
            field('name').value = expense.name;
            field('category').value = expense.category;
            field('amount').value = Math.abs(expense.amount);
            field('reportGain').checked = expense.amount > 0;
            field('date').value = localDateInput(new Date(expense.date));
            tags.render(expense.tags || []);
            form.dataset.editId = expense.id;
            submit.textContent = 'Update Expense';
            form.scrollIntoView({ behavior: 'smooth' });
        },
    };
}
