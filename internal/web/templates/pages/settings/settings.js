import { initI18n, t } from '/shared/i18n.js';
import { createSettingsCategories } from '/components/settings/categories.js';
import { createSettingsImportExport } from '/components/settings/import-export.js';
import { createSettingsPreferences } from '/components/settings/preferences.js';
import { createSettingsRecurringTransactions } from '/components/settings/recurring-transactions.js';

await initI18n();

let config = {};
let expenses = [];
let recurringExpenses = [];
const allTags = new Set();
let categories;
let preferences;
let recurring;

function collectTags() {
    allTags.clear();
    [...expenses, ...recurringExpenses].forEach(expense => {
        (expense.tags || []).forEach(tag => allTags.add(tag));
    });
}

async function loadSettings() {
    try {
        const [configResponse, expensesResponse, recurringResponse] = await Promise.all([
            fetch('/config'),
            fetch('/expenses'),
            fetch('/recurring-expenses')
        ]);
        if (!configResponse.ok) throw new Error('Failed to fetch configuration');
        if (!expensesResponse.ok) throw new Error('Failed to fetch expenses');
        if (!recurringResponse.ok) throw new Error('Failed to fetch recurring expenses');
        config = await configResponse.json();
        expenses = await expensesResponse.json();
        recurringExpenses = await recurringResponse.json() || [];
        collectTags();

        if (!categories) {
            preferences = createSettingsPreferences(config, {
                onCurrencyChange: currency => recurring?.setCurrency(currency)
            });
            recurring = createSettingsRecurringTransactions({
                categories: config.categories || [],
                currency: config.currency,
                allTags,
                recurringExpenses,
                onRecurringExpensesChange: nextExpenses => { recurringExpenses = nextExpenses; }
            });
            categories = createSettingsCategories({
                categories: config.categories || [],
                onChange: nextCategories => recurring.updateCategories(nextCategories)
            });
            createSettingsImportExport({ onImported: loadSettings });
        } else {
            preferences.updateConfig(config);
            categories.setCategories(config.categories || []);
            recurring.refresh({ categories: config.categories || [], currency: config.currency, recurringExpenses, allTags });
        }
    } catch (error) {
        console.error('Failed to initialize settings:', error);
        const message = document.getElementById('categoriesMessage');
        if (message) {
            message.textContent = t('settings.loadFailed');
            message.className = 'form-message error';
        }
    }
}

async function loadVersion() {
    try {
        const response = await fetch('/version');
        const version = response.ok ? await response.text() : 'dev';
        const link = document.getElementById('version-link');
        if (!link) return;
        link.textContent = version;
        if (version !== 'dev') link.href = `https://github.com/DavyCools/expenseowl/releases/tag/${version}`;
    } catch (error) {
        console.error('Failed to fetch version:', error);
    }
}

loadSettings();
loadVersion();
