import {readFile, writeFile} from 'node:fs/promises';

const source = await readFile(new URL('../WS.js', import.meta.url), 'utf8');
const body = source.replace(/^export .*;\r?\n/gm, '').trimEnd().replace(/^(?=.)/gm, '    ');
const script = `// Generated from WS.js by scripts/browser.js.\n'use strict';\n\n(function exposeWS() {\n${body}\n    globalThis.WS = WS;\n})();\n`;

await writeFile(new URL('../ws-share-vanilla.js', import.meta.url), script);
