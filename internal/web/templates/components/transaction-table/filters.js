import { formatCurrency } from '../../shared/currency.js';
import { formatDateFromUTC } from '../../shared/dates.js';

export function filterExpenses(expenses, filters, currency) {
    return expenses.filter(expense => {
        if (filters.name && !expense.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.category.length && !filters.category.includes(expense.category)) return false;
        if (filters.tags.length && !(expense.tags || []).some(tag => filters.tags.includes(tag))) return false;
        if (filters.amount) {
            const normalize = value => value.replace(/[^\d.\-]/g, '');
            const raw = String(Math.abs(expense.amount));
            const formatted = normalize(formatCurrency(expense.amount, currency));
            const value = normalize(filters.amount);
            if (value !== '' && !isNaN(value)) {
                if (Number(normalize(raw)) !== Number(value)) return false;
            } else if (!formatted.includes(value) && !raw.includes(value)) return false;
        }
        if (filters.date) {
            const [year, month, day] = filters.date.split('-');
            if (!`${day}/${month}/${year}`.includes(formatDateFromUTC(expense.date))) return false;
        }
        return true;
    });
}
