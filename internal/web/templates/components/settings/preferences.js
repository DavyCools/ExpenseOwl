import { t, errorText, responseError } from '/shared/i18n.js';
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
                showMessage('currencyMessage', t('settings.currencySaved'), true);
            } else {
                showMessage('currencyMessage', await responseError(response, 'settings.currencyFailed'), false);
            }
        } catch (error) {
            console.error('Error saving currency:', error);
            showMessage('currencyMessage', t('settings.currencyError'), false);
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
            showMessage('startDateMessage', response.ok ? t('settings.startDateSaved') :
                await responseError(response, 'settings.startDateFailed'), response.ok);
        } catch (error) {
            console.error('Error saving start date:', error);
            showMessage('startDateMessage', t('settings.startDateError'), false);
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
                showMessage('futureTransactionsMessage', errorText(error, 'errors.futureSave'), false);
                return;
            }
            showMessage('futureTransactionsMessage', t('settings.futureSaved'), true);
        } catch (error) {
            console.error('Error saving future transaction settings:', error);
            showMessage('futureTransactionsMessage', t('errors.futureSave'), false);
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
        showMessage('themeMessage', t('settings.themeSaved'), true);
    });

    updateConfig(config);
    const languageSelect = document.getElementById('languageSelect');
    const saveLanguage = document.getElementById('saveLanguage');
    async function loadLanguages() {
        try {
            const response = await fetch('/locales/');
            if (!response.ok) throw new Error('Unable to fetch supported languages');
            const languages = await response.json();
            languageSelect.replaceChildren(...languages.map(language => {
                const option = cloneTemplate('option-template');
                option.value = language.code;
                option.textContent = language.name;
                return option;
            }));
            languageSelect.value = config.language || 'en';
            languageSelect.disabled = false;
            saveLanguage.disabled = false;
        } catch (error) {
            console.error('Unable to initialize language preference', error);
            showMessage('languageMessage', t('settings.languageFailed'), false);
        }
    }
    saveLanguage.addEventListener('click', async () => {
        saveLanguage.disabled = true;
        languageSelect.disabled = true;
        try {
            const response = await fetch('/language/edit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(languageSelect.value)
            });
            if (!response.ok) {
                showMessage('languageMessage', await responseError(response, 'settings.languageFailed'), false);
                return;
            }
            showMessage('languageMessage', t('settings.languageSaved'), true);
            window.location.reload();
        } catch (error) {
            console.error('Unable to save language preference', error);
            showMessage('languageMessage', t('settings.languageFailed'), false);
        } finally {
            saveLanguage.disabled = false;
            languageSelect.disabled = false;
        }
    });
    const ready = loadLanguages();
    return { updateConfig, ready, getCurrency: () => currentCurrency, getStartDate: () => currentStartDate };
}
