import i18next from '/vendor/i18next.js';

let instance;
let locale = 'en-US';
let initialization;
let englishStrings;

async function catalog(language) {
    const response = await fetch(`/locales/${encodeURIComponent(language)}.json`);
    if (!response.ok) throw new Error(`Unable to load catalog: ${language} (${response.status})`);
    return response.json();
}

export function initI18n() {
    if (!initialization) initialization = initialize();
    return initialization;
}

async function initialize() {
    try {
        const language = document.documentElement.lang || 'en';
        const english = await catalog('en');
        englishStrings = english.translation;
        const selected = language === 'en' ? english : await catalog(language);
        locale = selected.locale;
        instance = i18next.createInstance();
        await instance.init({
            lng: selected.code,
            fallbackLng: 'en',
            keySeparator: false,
            resources: {
                en: { translation: english.translation },
                [selected.code]: { translation: selected.translation }
            },
            interpolation: { escapeValue: false },
            returnEmptyString: false
        });
        document.addEventListener('invalid', event => validateField(event.target), true);
        document.addEventListener('input', event => event.target.setCustomValidity?.(''), true);
        document.addEventListener('change', event => event.target.setCustomValidity?.(''), true);
        document.addEventListener('reset', event => clearFormValidation(event.target), true);
    } catch (error) {
        console.error('LOCALIZATION ERROR: initialization failed', error);
        // The initial HTML already contains a server-translated failure message.
        const message = document.getElementById('translationError');
        if (message) message.hidden = false;
        throw error;
    }
}

export function t(key, params = {}) {
    if (!instance) throw new Error('Translations must initialize before rendering components');
    if (!instance.exists(key, { lng: instance.language, fallbackLng: false, ...params })) {
        console.error(`LOCALIZATION ERROR: missing ${instance.language} translation ${key}`);
    }
    if (!instance.exists(key, params)) throw new Error(`Missing English translation: ${key}`);
    const source = englishStrings[key] || englishStrings[`${key}_${new Intl.PluralRules('en').select(params.count)}`];
    for (const [, name] of (source || '').matchAll(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g)) {
        if (!Object.hasOwn(params, name)) throw new Error(`Missing interpolation parameter ${name} for ${key}`);
    }
    return instance.t(key, params);
}

export function getLocale() { return locale; }

export function errorText(error, fallback = 'errors.unexpected') {
    if (error?.code && instance.exists(error.code)) {
        const params = { ...error.params };
        if (params.reason) {
            params.message = t(params.reason);
            delete params.reason;
        }
        return t(error.code, params);
    }
    console.error('API error without a recognized translation code', error);
    return t(fallback);
}

export async function responseError(response, fallback) {
    try {
        return errorText(await response.json(), fallback);
    } catch (error) {
        console.error('Unable to read API error response', error);
        return t(fallback);
    }
}

export function clearFormValidation(form) {
    for (const field of form.elements) field.setCustomValidity?.('');
}

export function validateField(field) {
    if (!field?.validity || typeof field.setCustomValidity !== 'function') return;
    field.setCustomValidity('');
    const state = field.validity;
    if (state.valid) return;
    let key = 'validation.invalid';
    if (state.valueMissing) key = 'validation.required';
    else if (state.rangeUnderflow) key = 'validation.min';
    else if (state.rangeOverflow) key = 'validation.max';
    else if (state.stepMismatch) key = 'validation.step';
    field.setCustomValidity(t(key, { min: field.min, max: field.max, step: field.step }));
}
