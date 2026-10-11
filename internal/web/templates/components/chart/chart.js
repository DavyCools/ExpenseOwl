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
            if (expense.amount < 0 && !disabledCategories.has(expense.category)) {
                const amount = Math.abs(expense.amount);
                totals.set(expense.category, (totals.get(expense.category) || 0) + amount);
                totalAmount += amount;
            }
        });
        return [...totals].map(([category, total]) => ({
            category,
            total,
            percentage: totalAmount > 0 ? (total / totalAmount) * 100 : 0
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
        pieChart = new Chart('categoryPieChart', {
            type: 'doughnut',
            data: {
                labels: categoryData.map(item => item.category),
                datasets: [{
                    data: categoryData.map(item => item.total),
                    backgroundColor: categoryData.map(item => categoryColors.get(item.category)),
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
                                return `${context.label}: ${money(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
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
        const categories = [...new Set(expenses.filter(expense => expense.amount < 0)
            .map(expense => expense.category))];
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
            item.querySelector('.amount').textContent = data ? money(data.total) : '';
            item.addEventListener('click', () => {
                if (disabledCategories.has(category)) disabledCategories.delete(category);
                else disabledCategories.add(category);
                update();
            });
            legendContainer.appendChild(item);
            const tagTotals = new Map();
            if (showTags) {
                expenses.filter(expense => expense.amount < 0 && expense.category === category && Array.isArray(expense.tags))
                    .forEach(expense => expense.tags.forEach(tag => {
                        tagTotals.set(tag, (tagTotals.get(tag) || 0) + Math.abs(expense.amount));
                    }));
            }
            if (tagTotals.size > 0) {
                const tagList = cloneTemplate('chart-tag-list-template');
                [...tagTotals].sort((a, b) => b[1] - a[1]).forEach(([tag, total]) => {
                    const tagRow = cloneTemplate('chart-tag-template');
                    const tagPercentage = data && data.total > 0 ? ` (${((total / data.total) * 100).toFixed(1)}%)` : '';
                    tagRow.querySelector('.legend-tag-name').textContent = `• ${tag}${tagPercentage}`;
                    tagRow.querySelector('.amount').textContent = money(total);
                    tagList.appendChild(tagRow);
                });
                legendContainer.appendChild(tagList);
            } else {
                item.classList.add('legend-item-without-tags');
            }
        });
        const total = cloneTemplate('chart-total-template');
        const activeTotal = expenses.filter(expense => expense.amount < 0 && !disabledCategories.has(expense.category))
            .reduce((sum, expense) => sum + Math.abs(expense.amount), 0);
        total.querySelector('.amount').textContent = money(activeTotal);
        legendContainer.appendChild(total);
    }

    function update() {
        updateCashflow();
        const hasExpenses = expenses.some(expense => expense.amount < 0);
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
            noDataMessage.textContent = 'No expenses recorded this time period.' + futureMessage;
            update();
        },
        destroy() {
            if (pieChart) pieChart.destroy();
            pieChart = null;
        }
    };
}
