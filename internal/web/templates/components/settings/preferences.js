import { currencyBehaviors } from '/shared/currency.js';
import { cloneTemplate } from '/shared/dom.js';
import { showMessage } from '/shared/messages.js';

export function createSettingsPreferences(config = {}, { onCurrencyChange = () => {} } = {}) {
    let currentCurrency = config.currency || 'usd';
    let currentStartDate = config.startDate || 1;
    const currencySelect = document.getElementById('currencySelect');
    const themeSelect = document.getElementById('themeSelect');

    function updateConfig(nextConfig) {
        currentCurrency = nextConfig.currency || 'usd';
        currentStartDate = nextConfig.startDate || 1;
        document.getElementById('startDate').value = currentStartDate;
        document.getElementById('showFutureTransactions').checked = Boolean(nextConfig.showFutureTransactions);
        document.getElementById('includeFutureTransactions').checked = Boolean(nextConfig.includeFutureTransactions);
        document.getElementById('showFutureTransactions').disabled = false;
        document.getElementById('includeFutureTransactions').disabled = false;
        document.getElementById('saveFutureTransactionsSettings').disabled = false;
        renderCurrencies();
    }

    function renderCurrencies() {
        const options = Object.entries(currencyBehaviors).map(([code, behavior]) => {
            const option = cloneTemplate('option-template');
            option.value = code;
            option.textContent = `${code.toUpperCase()} (${behavior.symbol})`;
            return option;
        });
        currencySelect.replaceChildren(...options);
        currencySelect.value = currentCurrency;
    }

    document.getElementById('saveCurrency').addEventListener('click', async () => {
        const currencyCode = currencySelect.value;
        try {
            const response = await fetch('/currency/edit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currencyCode)
            });
            if (response.ok) {
                currentCurrency = currencyCode;
                onCurrencyChange(currencyCode);
                showMessage('currencyMessage', 'Currency saved successfully', true);
            } else {
                showMessage('currencyMessage', 'Failed to save currency', false);
            }
        } catch (error) {
            console.error('Error saving currency:', error);
            showMessage('currencyMessage', 'Error saving currency', false);
        }
    });

    document.getElementById('saveStartDate').addEventListener('click', async () => {
        const startDateValue = document.getElementById('startDate').value;
        try {
            const response = await fetch('/startdate/edit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parseInt(startDateValue, 10))
            });
            if (response.ok) currentStartDate = parseInt(startDateValue, 10);
            showMessage('startDateMessage', response.ok ? 'Start date saved successfully' : 'Failed to save start date', response.ok);
        } catch (error) {
            console.error('Error saving start date:', error);
            showMessage('startDateMessage', 'Error saving start date', false);
        }
    });

    document.getElementById('saveFutureTransactionsSettings').addEventListener('click', async () => {
        const button = document.getElementById('saveFutureTransactionsSettings');
        button.disabled = true;
        try {
            const response = await fetch('/future-transactions/edit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    showFutureTransactions: document.getElementById('showFutureTransactions').checked,
                    includeFutureTransactions: document.getElementById('includeFutureTransactions').checked
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save future transaction settings');
            }
            showMessage('futureTransactionsMessage', 'Future transaction settings saved successfully', true);
        } catch (error) {
            console.error('Error saving future transaction settings:', error);
            showMessage('futureTransactionsMessage', error.message, false);
        } finally {
            button.disabled = false;
        }
    });

    const currentTheme = localStorage.getItem('theme') || 'system';
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', event => {
        const theme = event.target.value;
        localStorage.setItem('theme', theme);
        if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
        else document.documentElement.removeAttribute('data-theme');
        showMessage('themeMessage', 'Theme updated successfully.', true);
    });

    updateConfig(config);
    return { updateConfig, getCurrency: () => currentCurrency, getStartDate: () => currentStartDate };
}
