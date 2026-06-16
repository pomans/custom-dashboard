/**
 * gen-scoped-css.js
 * Generates src/styles/app-scoped.css from src/styles/app.css
 * by prefixing every selector with .dashboard-builder-root
 *
 * Usage: node scripts/gen-scoped-css.js
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const ROOT = path.resolve(__dirname, '..');
const INPUT  = path.join(ROOT, 'src/styles/app.css');
const OUTPUT = path.join(ROOT, 'src/styles/app-scoped.css');
const PREFIX = '.dashboard-builder-root';

// @import lines at the top of app.css (keep as-is)
const PASSTHROUGH_AT_RULES = new Set(['keyframes', 'font-face', 'import', 'charset', 'layer']);

function prefixSelector(selector) {
  // Split compound selectors on comma, prefix each part
  return selector
    .split(',')
    .map((s) => {
      const trimmed = s.trim();
      // :root → PREFIX itself
      if (trimmed === ':root') return PREFIX;
      // html / body → replace with PREFIX
      if (/^(html|body)(\s|:|$)/.test(trimmed)) return `${PREFIX}${trimmed.replace(/^(html|body)/, '')}`.trim();
      // Already prefixed (safety)
      if (trimmed.startsWith(PREFIX)) return trimmed;
      // Prepend prefix
      return `${PREFIX} ${trimmed}`;
    })
    .join(',\n');
}

const plugin = () => ({
  postcssPlugin: 'prefix-root',
  Rule(rule) {
    // Skip rules inside @keyframes
    let parent = rule.parent;
    while (parent) {
      if (parent.type === 'atrule' && PASSTHROUGH_AT_RULES.has(parent.name.toLowerCase())) return;
      parent = parent.parent;
    }
    rule.selector = prefixSelector(rule.selector);
  },
});
plugin.postcss = true;

const css = fs.readFileSync(INPUT, 'utf8');

postcss([plugin])
  .process(css, { from: INPUT, to: OUTPUT })
  .then((result) => {
    fs.writeFileSync(OUTPUT, result.css);
    console.log(`✓ Generated ${path.relative(ROOT, OUTPUT)}`);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
