import { cloneTemplate } from '../../shared/dom.js';

export function createTagInput({
    input, selectedContainer, dropdown, getAvailableTags,
    selectedTags = new Set(), normalize = tag => tag.trim(),
}) {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    function render(tags) {
        if (tags) {
            selectedTags.clear();
            tags.forEach(tag => selectedTags.add(tag));
        }
        selectedContainer.replaceChildren(...Array.from(selectedTags, tag => {
            const pill = cloneTemplate('tag-pill-template');
            pill.querySelector('[data-tag-name]').textContent = tag;
            pill.querySelector('.remove-tag').addEventListener('click', event => {
                event.stopPropagation();
                selectedTags.delete(tag);
                render();
            }, options);
            return pill;
        }));
    }
    function addTag(tag) {
        tag = normalize(tag);
        if (tag) {
            selectedTags.add(tag);
            render();
        }
        input.value = '';
        dropdown.style.display = 'none';
    }
    function suggestions(filter) {
        const value = filter ? input.value.trim().toLowerCase() : '';
        const allTags = Array.from(getAvailableTags());
        const nodes = [];
        if (value && !allTags.some(tag => tag.toLowerCase() === value)) {
            const item = cloneTemplate('tag-create-template');
            item.textContent = `+ Create "${input.value.trim()}"`;
            item.addEventListener('click', () => addTag(input.value), options);
            nodes.push(item);
        }
        for (const tag of allTags.filter(tag => !selectedTags.has(tag) && tag.toLowerCase().includes(value))) {
            const item = cloneTemplate('tag-option-template');
            item.textContent = tag;
            item.addEventListener('click', () => addTag(tag), options);
            nodes.push(item);
        }
        dropdown.replaceChildren(...nodes);
        dropdown.style.display = nodes.length ? 'block' : 'none';
    }
    input.addEventListener('focus', () => suggestions(false), options);
    input.addEventListener('input', () => suggestions(true), options);
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (input.value.trim()) addTag(input.value);
        }
    }, options);
    const container = input.closest('.tags-input-container');
    container.addEventListener('click', () => input.focus(), options);
    document.addEventListener('click', event => {
        if (!container.parentElement.contains(event.target)) dropdown.style.display = 'none';
    }, options);
    return {
        render,
        getTags: () => Array.from(selectedTags),
        clear() {
            selectedTags.clear();
            input.value = '';
            dropdown.style.display = 'none';
            render();
        },
        destroy: () => controller.abort(),
    };
}
