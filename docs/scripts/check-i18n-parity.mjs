import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(thisFile);
const docsRoot = path.resolve(scriptsDir, '..');

const ruDocsRoot = path.join(docsRoot, 'docs');
const enDocsRoot = path.join(docsRoot, 'i18n', 'en', 'docusaurus-plugin-content-docs', 'current');

async function walkDocs(dir) {
  const entries = await readdir(dir, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDocs(fullPath)));
      continue;
    }
    if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeRelative(root, fullPath) {
  return path.relative(root, fullPath).split(path.sep).join('/');
}

function diff(aSet, bSet) {
  return Array.from(aSet).filter((item) => !bSet.has(item)).sort((x, y) => x.localeCompare(y));
}

async function main() {
  const ruFiles = await walkDocs(ruDocsRoot);
  const enFiles = await walkDocs(enDocsRoot);

  const ruRel = new Set(ruFiles.map((filePath) => normalizeRelative(ruDocsRoot, filePath)));
  const enRel = new Set(enFiles.map((filePath) => normalizeRelative(enDocsRoot, filePath)));

  const missingInEn = diff(ruRel, enRel);
  const extraInEn = diff(enRel, ruRel);

  if (missingInEn.length === 0 && extraInEn.length === 0) {
    console.log(`i18n parity OK (${ruRel.size} docs).`);
    return;
  }

  if (missingInEn.length > 0) {
    console.error('Missing EN docs for:');
    for (const relPath of missingInEn) console.error(`  - ${relPath}`);
  }

  if (extraInEn.length > 0) {
    console.error('Extra EN docs not present in RU:');
    for (const relPath of extraInEn) console.error(`  - ${relPath}`);
  }

  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
