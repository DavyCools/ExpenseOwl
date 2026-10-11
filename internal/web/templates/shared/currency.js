export const colorPalette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFBE0B', '#FF006E', '#8338EC', '#3A86FF', 
    '#FB5607', '#38B000', '#9B5DE5', '#F15BB5'
];
export const currencyBehaviors = {
    usd: {symbol: "$", useComma: false, useDecimals: true, useSpace: false, right: false},
    eur: {symbol: "€", useComma: true, useDecimals: true, useSpace: false, right: false},
    gbp: {symbol: "£", useComma: false, useDecimals: true, useSpace: false, right: false},
    jpy: {symbol: "¥", useComma: false, useDecimals: false, useSpace: false, right: false},
    cny: {symbol: "¥", useComma: false, useDecimals: true, useSpace: false, right: false},
    krw: {symbol: "₩", useComma: false, useDecimals: false, useSpace: false, right: false},
    inr: {symbol: "₹", useComma: false, useDecimals: true, useSpace: false, right: false},
    rub: {symbol: "₽", useComma: true, useDecimals: true, useSpace: false, right: false},
    brl: {symbol: "R$", useComma: true, useDecimals: true, useSpace: false, right: false},
    zar: {symbol: "R", useComma: false, useDecimals: true, useSpace: true, right: true},
    aed: {symbol: "AED", useComma: false, useDecimals: true, useSpace: true, right: true},
    aud: {symbol: "A$", useComma: false, useDecimals: true, useSpace: false, right: false},
    cad: {symbol: "C$", useComma: false, useDecimals: true, useSpace: false, right: false},
    chf: {symbol: "Fr", useComma: false, useDecimals: true, useSpace: true, right: true},
    hkd: {symbol: "HK$", useComma: false, useDecimals: true, useSpace: false, right: false},
    bdt: {symbol: "৳", useComma: false, useDecimals: true, useSpace: false, right: false},
    sgd: {symbol: "S$", useComma: false, useDecimals: true, useSpace: false, right: false},
    thb: {symbol: "฿", useComma: false, useDecimals: true, useSpace: false, right: false},
    try: {symbol: "₺", useComma: true, useDecimals: true, useSpace: false, right: false},
    mxn: {symbol: "Mex$", useComma: false, useDecimals: true, useSpace: false, right: false},
    php: {symbol: "₱", useComma: false, useDecimals: true, useSpace: false, right: false},
    pln: {symbol: "zł", useComma: true, useDecimals: true, useSpace: true, right: true},
    sek: {symbol: "kr", useComma: false, useDecimals: true, useSpace: true, right: true},
    nzd: {symbol: "NZ$", useComma: false, useDecimals: true, useSpace: false, right: false},
    dkk: {symbol: "kr.", useComma: true, useDecimals: true, useSpace: true, right: true},
    idr: {symbol: "Rp", useComma: false, useDecimals: true, useSpace: true, right: true},
    ils: {symbol: "₪", useComma: false, useDecimals: true, useSpace: false, right: false},
    vnd: {symbol: "₫", useComma: true, useDecimals: false, useSpace: true, right: true},
    myr: {symbol: "RM", useComma: false, useDecimals: true, useSpace: false, right: false},
    mad: {symbol: "DH", useComma: false, useDecimals: true, useSpace: true, right: true},
};

export function formatCurrency(amount, currentCurrency = 'usd') {
    const behavior = currencyBehaviors[currentCurrency] || {
        symbol: "$",
        useComma: false,
        useDecimals: true,
        useSpace: false,
        right: false,
    };
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const options = {
        minimumFractionDigits: behavior.useDecimals ? 2 : 0,
        maximumFractionDigits: behavior.useDecimals ? 2 : 0,
    };
    let formattedAmount = new Intl.NumberFormat(behavior.useComma ? "de-DE" : "en-US",options).format(absAmount);
    let result = behavior.right
        ? `${formattedAmount}${behavior.useSpace ? " " : ""}${behavior.symbol}`
        : `${behavior.symbol}${behavior.useSpace ? " " : ""}${formattedAmount}`;
    return isNegative ? `-${result}` : result;
}

