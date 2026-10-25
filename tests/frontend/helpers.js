import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

export const templates = path.resolve(import.meta.dirname, '..', '..', 'internal', 'web', 'templates');

export async function browser(htmlFiles) {
    const html = (await Promise.all(htmlFiles.map(file => fs.readFile(path.join(templates, file), 'utf8')))).join('\n')
        .replace(/\{\{[\s\S]*?\}\}/g, '');
    const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
    const context = dom.getInternalVMContext();
    const modules = new Map();
    async function load(file) {
        file = path.resolve(file);
        if (modules.has(file)) return modules.get(file);
        const module = new vm.SourceTextModule(await fs.readFile(file, 'utf8'), { context, identifier: file });
        modules.set(file, module);
        await module.link((specifier, parent) => load(specifier.startsWith('/') ?
            path.join(templates, specifier.slice(1)) : path.resolve(path.dirname(parent.identifier), specifier)));
        return module;
    }
    return {
        window: dom.window,
        document: dom.window.document,
        async import(file) {
            const module = await load(path.join(templates, file));
            if (module.status !== 'evaluated') await module.evaluate();
            return module.namespace;
        },
        close: () => dom.window.close(),
    };
}
