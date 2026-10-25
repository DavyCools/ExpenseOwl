import { formatMonth, getExpenses } from '../../shared/dates.js';

export function createTransactionControls(onChange) {
    const state = { currentDate: new Date(), timeRange: 'month', includeFuture: false };
    let startDate = 1;
    let initialized = false;
    const toggle = document.getElementById('includeFutureToggle');
    const visibility = toggle.closest('.transaction-visibility');
    document.querySelectorAll('input[name="timeRange"]').forEach(radio => {
        radio.checked = radio.value === state.timeRange;
    });
    function updateDisplay() {
        document.getElementById('currentMonth').textContent = formatMonth(state.currentDate);
        document.getElementById('currentYear').textContent = state.currentDate.getFullYear();
        document.getElementById('month-navigation').style.display = state.timeRange === 'month' ? 'flex' : 'none';
        document.getElementById('year-navigation').style.display = state.timeRange === 'year' ? 'flex' : 'none';
    }
    function changed(periodChanged) {
        updateDisplay();
        onChange({ periodChanged });
    }
    document.querySelectorAll('input[name="timeRange"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            state.timeRange = radio.value;
            changed(true);
        });
    });
    for (const [id, unit, offset] of [
        ['prevMonth', 'month', -1], ['nextMonth', 'month', 1],
        ['prevYear', 'year', -1], ['nextYear', 'year', 1],
    ]) {
        document.getElementById(id).addEventListener('click', () => {
            if (unit === 'month') state.currentDate.setMonth(state.currentDate.getMonth() + offset);
            else state.currentDate.setFullYear(state.currentDate.getFullYear() + offset);
            changed(true);
        });
    }
    toggle.addEventListener('change', () => {
        state.includeFuture = toggle.checked;
        changed(false);
    });
    updateDisplay();
    return {
        state,
        updateDisplay,
        applyConfig(config) {
            startDate = config.startDate;
            if (!initialized || !config.showFutureTransactions) {
                state.includeFuture = config.includeFutureTransactions;
                toggle.checked = state.includeFuture;
            }
            initialized = true;
            visibility.hidden = !config.showFutureTransactions;
            updateDisplay();
        },
        getExpenses(expenses) {
            return getExpenses(expenses, state.timeRange, state.includeFuture, state.currentDate, startDate);
        },
        futureMessage() {
            if (state.includeFuture) return '';
            return visibility.hidden ?
                ' Future transactions are hidden. Change the default in Settings to include them.' :
                ' Future transactions are hidden. Enable "Future transactions" to show them.';
        },
    };
}
