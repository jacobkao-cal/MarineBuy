import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

test('GitHub Pages build is self-contained, uses static catalog data, and excludes Gemini UI', () => {
  execFileSync(process.execPath, ['scripts/build-pages.mjs'], { cwd: root, stdio: 'pipe' });
  const catalog = JSON.parse(readFileSync(path.join(output, 'data', 'catalog.json'), 'utf8'));
  const html = readFileSync(path.join(output, 'index.html'), 'utf8');
  const app = readFileSync(path.join(output, 'js', 'app.js'), 'utf8');
  const workspace = readFileSync(path.join(output, 'js', 'workspace.js'), 'utf8');
  const allScripts = readdirSync(path.join(output, 'js')).filter((name) => name.endsWith('.js'));

  assert.equal(catalog.products.length, 5);
  assert.equal(Object.keys(catalog.scores).length, catalog.products.length);
  assert.match(html, /href="css\/styles\.css"/);
  assert.match(html, /src="js\/app\.js"/);
  assert.match(app, /data\/catalog\.json/);
  assert.doesNotMatch(app, /\/api\/catalog|\/api\/research-chat/);
  assert.equal(new URL('data/catalog.json', 'https://jacobkao-cal.github.io/MarineBuy/').pathname, '/MarineBuy/data/catalog.json');
  assert.match(workspace, /not AI/);
  assert.doesNotMatch(workspace, /Google Gemini|AI RESEARCH ASSISTANT|\/api\/research-chat/);
  assert.equal(existsSync(path.join(output, 'js', 'assistant.js')), false);
  assert.deepEqual(allScripts.sort(), ['accounts.js', 'app.js', 'gear.js', 'likes.js', 'profile-hub.js', 'research.js', 'score.js', 'workspace-state.js', 'workspace.js'].sort());
  assert.equal(existsSync(path.join(output, '.nojekyll')), true);
});
