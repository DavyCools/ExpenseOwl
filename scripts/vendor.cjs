const fs = require('node:fs');
const path = require('node:path');
const destination = path.resolve(__dirname, '..', 'internal', 'web', 'templates', 'vendor');
const source = path.dirname(require.resolve('i18next/package.json'));
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(source, 'dist', 'esm', 'i18next.js'), path.join(destination, 'i18next.js'));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(destination, 'i18next.LICENSE'));
