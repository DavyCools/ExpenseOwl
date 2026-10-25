import { t } from '/shared/i18n.js';
import { colorPalette, formatCurrency } from '/shared/currency.js';
import { cloneTemplate } from '/shared/dom.js';

export function createChart() {
    let pieChart = null;
    let expenses = [];
    let currency = 'usd';
    const disabledCategories = new Set();
    const categoryColors = new Map();
    const chartBox = document.querySelector('.chart-box');
    const legendContainer = document.getElementById('customLegend');
    const cashflowSection = document.getElementById('cashflow-section');
    const noDataMessage = document.getElementById('noDataMessage');
    const money = amount => formatCurrency(amount, currency);

    Chart.defaults.color = '#b3b3b3';
    Chart.defaults.borderColor = '#606060';
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    function categoryBreakdown() {
        const totals = new Map();
        let totalAmount = 0;
        expenses.forEach(expense => {
            if (disabledCategories.has(expense.category) || expense.amount === 0) return;
            if (!totals.has(expense.category)) totals.set(expense.category, { outgoing: 0, incoming: 0 });
            const total = totals.get(expense.category);
            if (expense.amount < 0) {
                total.outgoing += Math.abs(expense.amount);
                totalAmount += Math.abs(expense.amount);
            } else total.incoming += expense.amount;
        });
        return [...totals].map(([category, amounts]) => ({
            category,
            ...amounts,
            total: amounts.outgoing - amounts.incoming,
            percentage: totalAmount > 0 ? (amounts.outgoing / totalAmount) * 100 : 0
        })).sort((a, b) => b.total - a.total);
    }

    function updateCashflow() {
        const income = expenses.filter(expense => expense.amount > 0)
            .reduce((sum, expense) => sum + expense.amount, 0);
        const total = expenses.filter(expense => expense.amount < 0)
            .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);
        const balance = income - total;
        document.getElementById('cashflow-income').textContent = money(income);
        document.getElementById('cashflow-expenses').textContent = money(total);
        const balanceElement = document.getElementById('cashflow-balance');
        balanceElement.textContent = money(balance);
        balanceElement.classList.toggle('positive', balance >= 0);
        balanceElement.classList.toggle('negative', balance < 0);
        cashflowSection.hidden = expenses.length === 0;
    }

    function updatePieChart(categoryData) {
        if (pieChart) pieChart.destroy();
        const slices = categoryData.filter(item => item.total > 0);
        pieChart = new Chart('categoryPieChart', {
            type: 'doughnut',
            data: {
                labels: slices.map(item => item.category),
                datasets: [{
                    data: slices.map(item => item.total),
                    backgroundColor: slices.map(item => categoryColors.get(item.category)),
                    borderColor: '#1a1a1a',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((sum, amount) => sum + amount, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return t('chart.tooltip', { category: context.label, amount: money(value), percentage });
                            }
                        }
                    }
                }
            }
        });
    }

    function renderAmount(placeholder, { outgoing, incoming }) {
        const amount = cloneTemplate('chart-amount-template');
        amount.querySelector('.legend-amount-breakdown').hidden = outgoing === 0 || incoming === 0;
        amount.querySelector('.legend-outgoing').textContent = money(outgoing);
        amount.querySelector('.legend-incoming').textContent = money(incoming);
        amount.querySelector('.legend-net').textContent = money(outgoing - incoming);
        placeholder.replaceWith(amount);
    }

    function updateLegend(categoryData) {
        legendContainer.replaceChildren();
        const savedShowTags = window.localStorage.getItem('showTagsInLegend');
        const showTags = savedShowTags === null || savedShowTags === '1';
        const toggle = cloneTemplate('chart-tags-toggle-template');
        const input = toggle.querySelector('input');
        input.checked = showTags;
        input.addEventListener('change', () => {
            window.localStorage.setItem('showTagsInLegend', input.checked ? '1' : '0');
            updateLegend(categoryData);
        });
        legendContainer.appendChild(toggle);
        const categories = [...new Set(expenses.map(expense => expense.category))];
        const categoryMap = new Map(categoryData.map(item => [item.category, item]));
        categories.sort((a, b) => {
            const dataA = categoryMap.get(a);
            const dataB = categoryMap.get(b);
            if (dataA && dataB) return dataB.total - dataA.total;
            if (dataA) return -1;
            if (dataB) return 1;
            return a.localeCompare(b);
        }).forEach(category => {
            const item = cloneTemplate('chart-category-template');
            item.classList.toggle('disabled', disabledCategories.has(category));
            item.querySelector('.color-box').style.backgroundColor = categoryColors.get(category);
            const data = categoryMap.get(category);
            const percentage = data ? ` (${data.percentage.toFixed(1)}%)` : '';
            item.querySelector('.legend-category').textContent = `${category}${percentage}`;
            if (data) renderAmount(item.querySelector('.amount'), data);
            item.addEventListener('click', () => {
                if (disabledCategories.has(category)) disabledCategories.delete(category);
                else disabledCategories.add(category);
                update();
            });
            legendContainer.appendChild(item);
            const tagTotals = new Map();
            if (showTags) {
                expenses.filter(expense => expense.amount !== 0 && expense.category === category && Array.isArray(expense.tags))
                    .forEach(expense => expense.tags.forEach(tag => {
                        if (!tagTotals.has(tag)) tagTotals.set(tag, { outgoing: 0, incoming: 0 });
                        const total = tagTotals.get(tag);
                        if (expense.amount < 0) total.outgoing += Math.abs(expense.amount);
                        else total.incoming += expense.amount;
                    }));
            }
            if (tagTotals.size > 0) {
                const tagList = cloneTemplate('chart-tag-list-template');
                tagList.classList.toggle('disabled', disabledCategories.has(category));
                [...tagTotals].sort((a, b) =>
                    (b[1].outgoing - b[1].incoming) - (a[1].outgoing - a[1].incoming)
                ).forEach(([tag, total]) => {
                    const tagRow = cloneTemplate('chart-tag-template');
                    const net = total.outgoing - total.incoming;
                    const tagPercentage = data && data.total > 0 ? ` (${((net / data.total) * 100).toFixed(1)}%)` : '';
                    tagRow.querySelector('.legend-tag-name').textContent = `• ${tag}${tagPercentage}`;
                    if (data) renderAmount(tagRow.querySelector('.amount'), total);
                    tagList.appendChild(tagRow);
                });
                legendContainer.appendChild(tagList);
            } else {
                item.classList.add('legend-item-without-tags');
            }
        });
        const total = cloneTemplate('chart-total-template');
        renderAmount(total.querySelector('.amount'), categoryData.reduce((amounts, item) => ({
            outgoing: amounts.outgoing + item.outgoing,
            incoming: amounts.incoming + item.incoming
        }), { outgoing: 0, incoming: 0 }));
        legendContainer.appendChild(total);
    }

    function update() {
        updateCashflow();
        const hasExpenses = expenses.some(expense => expense.amount !== 0);
        chartBox.hidden = !hasExpenses;
        legendContainer.hidden = !hasExpenses;
        noDataMessage.hidden = hasExpenses;
        if (!hasExpenses) {
            if (pieChart) pieChart.destroy();
            pieChart = null;
            return;
        }
        const categoryData = categoryBreakdown();
        updatePieChart(categoryData);
        updateLegend(categoryData);
    }

    return {
        render({ expenses: nextExpenses, categories, currency: nextCurrency = 'usd', futureMessage = '' }) {
            expenses = nextExpenses;
            currency = nextCurrency;
            categories.forEach((category, index) => {
                if (!categoryColors.has(category)) {
                    categoryColors.set(category, colorPalette[index % colorPalette.length]);
                }
            });
            noDataMessage.textContent = t('chart.empty') + futureMessage;
            update();
        },
        destroy() {
            if (pieChart) pieChart.destroy();
            pieChart = null;
        }
    };
}
