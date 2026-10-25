export function cloneTemplate(id) {
    const template = document.getElementById(id);
    if (!(template instanceof HTMLTemplateElement) || !template.content.firstElementChild) {
        throw new Error(`Missing HTML template: ${id}`);
    }
    return template.content.firstElementChild.cloneNode(true);
}

export function populateOptions(select, values) {
    const selected = select.value;
    select.replaceChildren(...values.map(value => {
        const option = cloneTemplate('option-template');
        option.value = value;
        option.textContent = value;
        return option;
    }));
    if (values.includes(selected)) select.value = selected;
}
