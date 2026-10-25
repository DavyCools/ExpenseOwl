import { t, errorText } from '/shared/i18n.js';
import { cloneTemplate } from '/shared/dom.js';
import { showMessage } from '/shared/messages.js';

export function createSettingsCategories({ categories = [], onChange = () => {} } = {}) {
    let categoryNames = [...categories];
    let draggedIndex = null;
    const list = document.getElementById('categories-list');

    function render() {
        const fragment = document.createDocumentFragment();
        categoryNames.forEach((category, index) => {
            const item = cloneTemplate('category-item-template');
            item.dataset.index = String(index);
            item.querySelector('.category-name').textContent = category;
            item.querySelector('.category-rename-input').value = category;
            fragment.appendChild(item);
        });
        list.replaceChildren(fragment);
    }

    function notifyChange() {
        render();
        onChange([...categoryNames]);
    }

    function removePlaceholders() {
        list.querySelectorAll('.placeholder').forEach(placeholder => placeholder.remove());
    }

    function setRenameMode(item, enabled) {
        item.querySelector('.category-name').hidden = enabled;
        item.querySelector('.category-rename-input').hidden = !enabled;
        item.querySelector('[data-action="rename"]').hidden = enabled;
        item.querySelector('[data-action="delete"]').hidden = enabled;
        item.querySelector('[data-action="save-rename"]').hidden = !enabled;
        item.querySelector('[data-action="cancel-rename"]').hidden = !enabled;
        if (enabled) {
            const input = item.querySelector('.category-rename-input');
            input.focus();
            input.select();
        }
    }

    async function saveRename(item, index) {
        const input = item.querySelector('.category-rename-input');
        const oldName = categoryNames[index];
        const newName = input.value.trim().replace(/[<>]/g, ' ').trim();
        if (!newName) {
            showMessage('categoriesMessage', t('settings.categoryEmpty'), false);
            return;
        }
        if (newName === oldName) {
            setRenameMode(item, false);
            return;
        }
        if (categoryNames.includes(newName)) {
            showMessage('categoriesMessage', t('settings.categoryDuplicate'), false);
            return;
        }

        try {
            const response = await fetch('/categories/rename', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldName, newName })
            });
            if (!response.ok) {
                const error = await response.json();
                showMessage('categoriesMessage', t('settings.renameFailed', { message: errorText(error) }), false);
                return;
            }
            categoryNames[index] = newName;
            notifyChange();
            showMessage('categoriesMessage', t('settings.categoryRenamed'), true);
        } catch (error) {
            console.error('Error renaming category:', error);
            showMessage('categoriesMessage', t('settings.renameError'), false);
        }
    }

    async function saveCategories() {
        if (categoryNames.length === 0) {
            showMessage('categoriesMessage', t('settings.categoryRequired'), false);
            return;
        }
        try {
            const response = await fetch('/categories/edit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryNames)
            });
            if (response.ok) {
                showMessage('categoriesMessage', t('settings.categoriesSaved'), true);
            } else {
                const error = await response.json();
                showMessage('categoriesMessage', t('settings.categoriesFailed', { message: errorText(error) }), false);
            }
        } catch (error) {
            console.error('Error saving categories:', error);
            showMessage('categoriesMessage', t('settings.categoriesError'), false);
        }
    }

    document.getElementById('addCategory').addEventListener('click', () => {
        const input = document.getElementById('newCategory');
        const category = input.value.trim().replace(/[<>]/g, ' ').trim();
        if (category && !categoryNames.includes(category)) {
            categoryNames.push(category);
            notifyChange();
            input.value = '';
        } else if (categoryNames.includes(category)) {
            showMessage('categoriesMessage', t('settings.categoryExists'), false);
        } else {
            showMessage('categoriesMessage', t('settings.categoryEmpty'), false);
        }
    });
    document.getElementById('saveCategories').addEventListener('click', saveCategories);
    document.getElementById('newCategory').addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.getElementById('addCategory').click();
        }
    });

    list.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const item = button.closest('.category-item');
        const index = Number(item.dataset.index);
        switch (button.dataset.action) {
            case 'rename':
                setRenameMode(item, true);
                break;
            case 'cancel-rename':
                item.querySelector('.category-rename-input').value = categoryNames[index];
                setRenameMode(item, false);
                break;
            case 'save-rename':
                saveRename(item, index);
                break;
            case 'delete':
                categoryNames.splice(index, 1);
                notifyChange();
                break;
        }
    });

    list.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        const input = event.target.closest('.category-rename-input');
        if (!input) return;
        event.preventDefault();
        if (event.key === 'Enter') input.closest('.category-item').querySelector('[data-action="save-rename"]').click();
        else input.closest('.category-item').querySelector('[data-action="cancel-rename"]').click();
    });

    list.addEventListener('dragstart', event => {
        const item = event.target.closest('.category-item');
        if (!item) return;
        draggedIndex = Number(item.dataset.index);
        item.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(draggedIndex));
        removePlaceholders();
    });

    list.addEventListener('dragover', event => {
        if (draggedIndex === null) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        const item = event.target.closest('.category-item');
        if (!item) return;
        item.classList.add('drag-over');
        if (Number(item.dataset.index) === draggedIndex) return;
        removePlaceholders();
        const placeholder = cloneTemplate('category-placeholder-template');
        const before = event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2;
        list.insertBefore(placeholder, before ? item : item.nextSibling);
    });

    list.addEventListener('dragleave', event => {
        const item = event.target.closest('.category-item');
        if (item && !item.contains(event.relatedTarget)) item.classList.remove('drag-over');
    });

    list.addEventListener('drop', event => {
        if (draggedIndex === null) return;
        event.preventDefault();
        const fromIndex = draggedIndex;
        const item = event.target.closest('.category-item');
        let toIndex;
        if (item) {
            toIndex = Number(item.dataset.index);
            const rect = item.getBoundingClientRect();
            if (event.clientY >= rect.top + rect.height / 2) toIndex++;
        } else {
            const placeholder = list.querySelector('.placeholder');
            if (!placeholder) return;
            toIndex = Array.from(list.children).slice(0, Array.from(list.children).indexOf(placeholder))
                .filter(child => child.classList.contains('category-item')).length;
        }
        if (fromIndex < toIndex) toIndex--;
        if (fromIndex !== toIndex) {
            const [movedCategory] = categoryNames.splice(fromIndex, 1);
            categoryNames.splice(toIndex, 0, movedCategory);
            notifyChange();
        }
        draggedIndex = null;
        removePlaceholders();
        list.querySelectorAll('.category-item').forEach(category => {
            category.classList.remove('dragging', 'drag-over');
        });
    });

    list.addEventListener('dragend', event => {
        event.target.closest('.category-item')?.classList.remove('dragging');
        list.querySelectorAll('.category-item').forEach(item => item.classList.remove('drag-over'));
        removePlaceholders();
        draggedIndex = null;
    });

    render();
    return {
        getCategories: () => [...categoryNames],
        setCategories(nextCategories) {
            categoryNames = [...nextCategories];
            render();
        }
    };
}
