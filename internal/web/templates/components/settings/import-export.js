export function createSettingsImportExport({ onImported = () => {} } = {}) {
    const input = document.getElementById('csv-import-file');
    const message = document.getElementById('importMessage');
    const summary = document.getElementById('importSummary');

    input.addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        message.textContent = 'Importing... this may take a while for large files.';
        message.className = 'form-message';
        summary.hidden = true;

        try {
            const response = await fetch('/import/csv', { method: 'POST', body: formData });
            const result = await response.json();
            if (response.ok) {
                message.textContent = 'Import completed!';
                message.className = 'form-message success';
                summary.hidden = false;
                document.getElementById('summary-processed').textContent = result.total_processed;
                document.getElementById('summary-imported').textContent = result.imported;
                document.getElementById('summary-skipped').textContent = result.skipped;
                document.getElementById('summary-new-categories').textContent = (result.new_categories || []).join(', ') || 'None';
                await onImported();
            } else {
                message.textContent = `Error: ${result.error || 'Failed to import CSV'}`;
                message.className = 'form-message error';
            }
        } catch (error) {
            console.error('Error importing CSV:', error);
            message.textContent = 'Error: An unexpected error occurred during import.';
            message.className = 'form-message error';
        } finally {
            event.target.value = '';
        }
    });
}
