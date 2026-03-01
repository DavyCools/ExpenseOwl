let currentCurrency = 'usd';
let currentDate = new Date();
let allExpenses = [];
let expensesForTable = [];
let startDate = 1;
let allTags = new Set();
let selectedTags = new Set();
let timeRangeSelected = 'month';



// Filter state
let tableFilters = {
    name: '',
    category: '',
    tags: '',
    amount: '',
    date: ''
};


function createTable(expenses) {
    if (!expenses || expenses.length === 0) {
        const message = document.getElementById('showAllToggle').checked ? 
                        'No transactions found' : 
                        'No expenses recorded for this ' + timeRangeSelected;
        return `<div class="no-data">${message}</div>`;
    }
    // Use the global expensesForTable to determine if tags column should be shown
    const hasTags = expensesForTable.some(exp => exp.tags && exp.tags.length > 0);
    // Filter row in table header, with correct input types
    let filterRow = `<tr class="filter-row">
        <th><input type="text" id="filter-name" class="form-filter-input" placeholder="Filter" value="${tableFilters.name || ''}"></th>
        <th><input type="text" id="filter-category" class="form-filter-input" placeholder="Filter" value="${tableFilters.category || ''}"></th>
        ${hasTags ? '<th class="tags-column"><input type="text" id="filter-tags" class="form-filter-input" placeholder="Filter" value="' + (tableFilters.tags || '') + '"></th>' : ''}
        <th><input type="number" id="filter-amount" class="form-filter-input" placeholder="Filter" value="${tableFilters.amount || ''}"></th>
        <th class="date-header"><input type="date" id="filter-date" class="form-filter-input" placeholder="Filter" value="${tableFilters.date || ''}"></th>
        <th></th>
    </tr>`;
    return `
        <table class="expense-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Category</th>
                    ${hasTags ? '<th class="tags-column">Tags</th>' : ''}
                    <th>Amount</th>
                    <th class="date-header">Date</th>
                    <th></th>
                </tr>
                ${filterRow}
            </thead>
            <tbody id="expense-table-body">
                ${expenses.map((expense, index) => `
                    <tr>
                        <td>${escapeHTML(expense.name)}</td>
                        <td>${escapeHTML(expense.category)}</td>
                        ${hasTags ? `<td class="tags-column">${(expense.tags || []).map(escapeHTML).join(', ')}</td>` : ''}
                        <td class="amount">${formatCurrency(expense.amount)}</td>
                        <td class="date-column">${formatDateFromUTC(expense.date)}</td>
                        <td>
                            <button class="edit-button" onclick="editExpenseByIndex(${index})">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="delete-button" onclick="handleDeleteClick(event, '${expense.id}')">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
                ${expenses.length === 0 ? `<tr><td colspan="${hasTags ? 6 : 5}" class="no-data">No transactions found with current filters.</td></tr>` : ''}
            </tbody>
        </table>
    `;
}

function filterExpenses(expenses) {
    return expenses.filter(exp => {
        // Name
        if (tableFilters.name && !exp.name.toLowerCase().includes(tableFilters.name.toLowerCase())) return false;
        // Category
        if (tableFilters.category && !exp.category.toLowerCase().includes(tableFilters.category.toLowerCase())) return false;
        // Tags
        if (tableFilters.tags) {
            const tagsStr = (exp.tags || []).join(', ').toLowerCase();
            if (!tagsStr.includes(tableFilters.tags.toLowerCase())) return false;
        }
        // Amount
        if (tableFilters.amount) {
            // Remove all non-digit/decimal chars for comparison
            const normalize = str => str.replace(/[^\d.\-]/g, '');
            const amtRaw = String(Math.abs(exp.amount));
            const amtNormalized = normalize(amtRaw);
            const amtFormatted = normalize(formatCurrency(exp.amount));
            const filterVal = normalize(tableFilters.amount);
            // If filter is a valid number, require exact match
            if (filterVal !== '' && !isNaN(filterVal)) {
                if (Number(amtNormalized) !== Number(filterVal)) return false;
            } else {
                // Fallback to string includes for non-numeric input
                if (!amtFormatted.includes(filterVal) && !amtRaw.includes(filterVal)) return false;
            }
        }
        // Date
        if (tableFilters.date) {
            const dateString = formatDateFromUTC(exp.date);
            // tableFilters.date is in format YYYY-MM-DD, 
            // dateString is in format DD/MM/YYYY
            const [year, month, day] = tableFilters.date.split('-');
            const formattedFilterDate = `${day}/${month}/${year}`;
            if (!formattedFilterDate.includes(dateString)) return false;
        }
        return true;
    });
}



function updateTable() {
    const showAll = document.getElementById('showAllToggle').checked;
    document.querySelectorAll('.expense-navigation').forEach(el => {
        el.style.display = showAll ? 'none' : 'flex';
    });

    if (timeRangeSelected !== 'all' ) {
        if (timeRangeSelected === 'month') {
            document.getElementById('month-navigation').style.display = 'flex';
            document.getElementById('year-navigation').style.display = 'none';
            // Get year from currentMonth display and set it to currentDate to ensure correct filtering when navigating months
            const monthYear = parseInt(document.getElementById('currentMonth').innerText.split(' ')[1]);
            currentDate.setFullYear(monthYear);
        }
        else {
            document.getElementById('month-navigation').style.display = 'none';
            document.getElementById('year-navigation').style.display = 'flex';
            // Get year from currentYear display and set it to currentDate to ensure correct filtering when navigating years
            const year = parseInt(document.getElementById('currentYear').innerText);
            currentDate.setFullYear(year);
        }

        expensesForTable = getExpenses(allExpenses, timeRangeSelected);
    } else {
        expensesForTable = allExpenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Apply filters
    const filtered = filterExpenses(expensesForTable);
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = createTable(filtered);

    // Add filter input listeners (after table is rendered)
    const nameInput = document.getElementById('filter-name');
    if (nameInput) nameInput.addEventListener('input', e => { tableFilters.name = e.target.value; updateTableBody(); });
    const categoryInput = document.getElementById('filter-category');
    if (categoryInput) categoryInput.addEventListener('input', e => { tableFilters.category = e.target.value; updateTableBody(); });
    const tagsInput = document.getElementById('filter-tags');
    if (tagsInput) tagsInput.addEventListener('input', e => { tableFilters.tags = e.target.value; updateTableBody(); });
    const amountInput = document.getElementById('filter-amount');
    if (amountInput) amountInput.addEventListener('input', e => { tableFilters.amount = e.target.value; updateTableBody(); });
    const dateInput = document.getElementById('filter-date');
    if (dateInput) dateInput.addEventListener('input', e => { tableFilters.date = e.target.value; updateTableBody(); });
}

function updateTableBody() {
    // Only update tbody, not thead/inputs
    const filtered = filterExpenses(expensesForTable);
    const hasTags = expensesForTable.some(exp => exp.tags && exp.tags.length > 0);
    const tbody = document.getElementById('expense-table-body');
    if (!tbody) return;
    tbody.innerHTML = filtered.map((expense, index) => `
        <tr>
            <td>${escapeHTML(expense.name)}</td>
            <td>${escapeHTML(expense.category)}</td>
            ${hasTags ? `<td class="tags-column">${(expense.tags || []).map(escapeHTML).join(', ')}</td>` : ''}
            <td class="amount">${formatCurrency(expense.amount)}</td>
            <td class="date-column">${formatDateFromUTC(expense.date)}</td>
            <td>
                <button class="edit-button" onclick="editExpenseByIndex(${index})">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="delete-button" onclick="handleDeleteClick(event, '${expense.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${hasTags ? 6 : 5}" class="no-data" style="text-align:center;">No transactions found with current filters.</td></tr>`;
    }
}

function editExpenseByIndex(index) {
    const expense = expensesForTable[index];
    if (expense) {
        editExpense(expense.id, expense.name, expense.category, expense.amount, (expense.tags || []), expense.date);
    }
}

function renderSelectedTags(tags) {
    const selectedContainer = document.getElementById('selected-tags');
    selectedContainer.innerHTML = '';
    selectedTags.clear();
    (tags || []).forEach(tag => {
        selectedTags.add(tag);
        const pill = document.createElement('div');
        pill.className = 'tag-pill';
        pill.textContent = tag;
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-tag';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            selectedTags.delete(tag);
            pill.remove();
        };
        pill.appendChild(removeBtn);
        selectedContainer.appendChild(pill);
    });
}

function editExpense(id, name, category, amount, tags, date) {
    const isGain = amount > 0;
    document.getElementById('name').value = name;
    document.getElementById('category').value = category;
    document.getElementById('amount').value = Math.abs(amount);
    document.getElementById('reportGain').checked = isGain;
    renderSelectedTags(tags);
    
    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    document.getElementById('date').value = `${year}-${month}-${day}`;
    
    const form = document.getElementById('expenseForm');
    form.dataset.editId = id;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = 'Update Expense';
    
    form.scrollIntoView({ behavior: 'smooth' });
}

function setupTagInput() {
    const container = document.getElementById('tags-input-container');
    const input = document.getElementById('tags-input');
    const dropdown = document.getElementById('tags-dropdown');
    const formGroup = container.parentElement;

    const addTag = (tag) => {
        tag = tag.trim();
        if (tag && !selectedTags.has(tag)) {
            selectedTags.add(tag);
            renderSelectedTags(Array.from(selectedTags));
        }
        input.value = '';
        dropdown.style.display = 'none';
    };

    input.addEventListener('focus', () => {
        dropdown.innerHTML = '';
        const availableTags = [...allTags].filter(tag => !selectedTags.has(tag));
        if (availableTags.length > 0) {
            availableTags.forEach(tag => {
                const item = document.createElement('div');
                item.textContent = tag;
                item.onclick = () => addTag(tag);
                dropdown.appendChild(item);
            });
            dropdown.style.display = 'block';
        }
    });

    input.addEventListener('input', () => {
        const value = input.value.trim().toLowerCase();
        dropdown.innerHTML = '';
        const filteredTags = [...allTags].filter(tag => tag.toLowerCase().includes(value) && !selectedTags.has(tag));
        
        if(value && ![...allTags].map(t => t.toLowerCase()).includes(value)) {
            const newItem = document.createElement('div');
            newItem.textContent = `+ Create "${input.value.trim()}"`;
            newItem.className = 'new-tag';
            newItem.onclick = () => addTag(input.value.trim());
            dropdown.appendChild(newItem);
        }

        if (filteredTags.length > 0) {
            filteredTags.forEach(tag => {
                const item = document.createElement('div');
                item.textContent = tag;
                item.onclick = () => addTag(tag);
                dropdown.appendChild(item);
            });
        }
        
        dropdown.style.display = 'block';
        if (dropdown.children.length === 0) dropdown.style.display = 'none';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (input.value.trim()) {
                addTag(input.value.trim());
            }
        }
    });

    container.addEventListener('click', () => input.focus());
    document.addEventListener('click', (e) => {
        if (!formGroup.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

async function initialize() {
    try {
        const configResponse = await fetch('/config');
        if (!configResponse.ok) throw new Error('Failed to fetch configuration');
        const config = await configResponse.json();
        const categorySelect = document.getElementById('category');
        categorySelect.innerHTML = config.categories.map(cat => 
            `<option value="${cat}">${cat}</option>`
        ).join('');
        currentCurrency = config.currency;
        startDate = config.startDate;
        
        const response = await fetch('/expenses');
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        allExpenses = Array.isArray(data) ? data : (data && Array.isArray(data.expenses) ? data.expenses : []);
        
        allTags.clear();
        allExpenses.forEach(exp => {
            if (exp.tags) {
                exp.tags.forEach(tag => allTags.add(tag));
            }
        });

        updateMonthDisplay();
        updateYearDisplay();
        updateTable();
        setupTagInput();
    } catch (error) {
        console.error('Failed to initialize table:', error);
        document.getElementById('tableContainer').innerHTML = 
            '<div class="no-data">Failed to load expenses</div>';
    }
}

document.querySelectorAll('input[name="timeRange"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.checked) {
            timeRangeSelected = this.value;
            clearTableFilters();
            updateTable();
        }
    });
});


document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateMonthDisplay();
    clearTableFilters();
    updateTable();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateMonthDisplay();
    clearTableFilters();
    updateTable();
});

document.getElementById('prevYear').addEventListener('click', () => {
    currentDate.setFullYear(currentDate.getFullYear() - 1);
    updateYearDisplay();
    clearTableFilters();
    updateTable();
});

document.getElementById('nextYear').addEventListener('click', () => {
    currentDate.setFullYear(currentDate.getFullYear() + 1);
    updateYearDisplay();
    clearTableFilters();
    updateTable();
});
function clearTableFilters() {
    tableFilters = { name: '', category: '', tags: '', amount: '', date: '' };
}

let expenseToDelete = null;

function showDeleteModal(id) {
    expenseToDelete = id;
    document.getElementById('deleteModal').classList.add('active');
}

function handleDeleteClick(event, id) {
    if (event.shiftKey) {
        expenseToDelete = id;
        confirmDelete();
    } else {
        showDeleteModal(id);
    }
}

function closeDeleteModal() {
    expenseToDelete = null;
    document.getElementById('deleteModal').classList.remove('active');
}

async function confirmDelete() {
    if (!expenseToDelete) return;
    try {
        const response = await fetch(`/expense/delete?id=${expenseToDelete}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error('Failed to delete expense');
        }
        await initialize();
        closeDeleteModal();
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Failed to delete expense. Please try again.');
    }
}

document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target.className === 'modal active') {
        closeDeleteModal();
    }
});

document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const editId = form.dataset.editId;
    const isGain = document.getElementById('reportGain').checked;
    let amount = parseFloat(document.getElementById('amount').value);
    if (!isGain) {
        amount *= -1;
    }

    const formData = {
        name: document.getElementById('name').value,
        category: document.getElementById('category').value,
        amount: amount,
        date: getISODateWithLocalTime(document.getElementById('date').value),
        tags: Array.from(selectedTags)
    };
    try {
        const url = editId ? `/expense/edit?id=${editId}` : '/expense';
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const messageDiv = document.getElementById('formMessage');
        if (response.ok) {
            messageDiv.textContent = editId ? 'Expense updated successfully!' : 'Expense added successfully!';
            messageDiv.className = 'form-message success';
            form.reset();
            document.getElementById('selected-tags').innerHTML = '';
            selectedTags.clear();
            delete form.dataset.editId;
            form.querySelector('button[type="submit"]').textContent = 'Add Expense';
            await initialize();
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            document.getElementById('date').value = `${year}-${month}-${day}`;
        } else {
            const error = await response.json();
            messageDiv.textContent = `Error: ${error.error || 'Failed to save expense'}`;
            messageDiv.className = 'form-message error';
        }
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'form-message';
        }, 3000);
    } catch (error) {
        console.error('Error saving expense:', error);
        const messageDiv = document.getElementById('formMessage');
        messageDiv.textContent = 'Error: Failed to save expense';
        messageDiv.className = 'form-message error';
    }
});
document.addEventListener('DOMContentLoaded', initialize);

document.getElementById('name').addEventListener('click', (e) => {
    if (e.target.value === '-') {
        e.target.value = '';
    }
});

window.editExpenseByIndex = editExpenseByIndex;