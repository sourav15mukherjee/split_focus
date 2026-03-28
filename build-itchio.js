// build-itchio.js — Bundles the modular game into a single HTML file for itch.io
// Usage: node build-itchio.js
// Output: split_focus_itchio.html

const fs = require('fs');
const path = require('path');

const root = __dirname;

// Read all JS modules and concatenate (strip import/export statements)
const moduleOrder = [
    'js/persistence.js',
    'js/sound.js',
    'js/metrics.js',
    'js/achievements.js',
    'js/tutorial.js',
    'js/settings.js',
    'js/results.js',
    'js/dashboard.js',
    'js/training.js',
    'js/game.js',
];

let bundledJS = '';
for (const modPath of moduleOrder) {
    let code = fs.readFileSync(path.join(root, modPath), 'utf-8');

    // Strip import statements
    code = code.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
    code = code.replace(/^import\s*\{[^}]*\}\s*from\s*['"].*?['"];?\s*$/gm, '');

    // Convert "export function" -> "function", "export const" -> "const", etc.
    code = code.replace(/^export\s+(function|const|let|var|class)\s/gm, '$1 ');
    code = code.replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
    code = code.replace(/^export\s+default\s+/gm, '');

    bundledJS += `// ─── ${modPath} ───\n${code}\n\n`;
}

// Wrap in IIFE to avoid globals
bundledJS = `(function() {\n${bundledJS}\n})();`;

// Read CSS
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf-8');

// Read HTML and inject
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');

// Replace <link rel="stylesheet" href="css/style.css"> with inline <style>
html = html.replace(
    /<link\s+rel="stylesheet"\s+href="css\/style\.css"\s*\/?>/,
    `<style>\n${css}\n</style>`
);

// Replace <script type="module" src="js/game.js"></script> with inline <script>
html = html.replace(
    /<script\s+type="module"\s+src="js\/game\.js"\s*><\/script>/,
    `<script>\n${bundledJS}\n</script>`
);

const outPath = path.join(root, 'split_focus_itchio.html');
fs.writeFileSync(outPath, html, 'utf-8');

console.log(`Built: ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
