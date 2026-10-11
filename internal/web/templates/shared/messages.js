export function showMessage(elementId, message, isSuccess) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = isSuccess ? 'form-message success' : 'form-message error';
    setTimeout(() => {
        element.textContent = '';
        element.className = 'form-message';
    }, 3000);
}
