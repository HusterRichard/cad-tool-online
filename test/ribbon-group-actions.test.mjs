import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('group ribbon exposes only supported actions', async () => {
  const source = await readFile(new URL('../src/panels/CadEditorPanel.ts', import.meta.url), 'utf8');
  const groupBlocks = [...source.matchAll(/<div class="ribbon-tab-group">[\s\S]*?<div class="ribbon-tab-label">[^<]+<\/div>/g)];
  const groupBlock = groupBlocks.map((match) => match[0]).find((block) => block.includes('data-action-id="createGroup"'));

  assert.ok(groupBlock, 'expected to find the group ribbon block');
  assert.match(groupBlock, /data-action-id="createGroup"/);
  assert.match(groupBlock, /data-action-id="ungroupGroup"/);
  assert.match(groupBlock, /data-action-id="cleanGroup"/);
  assert.match(groupBlock, /data-action-id="createDefaultGroup"/);
  assert.doesNotMatch(groupBlock, /data-action-id="createChildGroup"/);
  assert.doesNotMatch(groupBlock, /data-action-id="renameGroup"/);
  assert.doesNotMatch(groupBlock, /data-action-id="moveToGroup"/);
  assert.doesNotMatch(groupBlock, /data-action-id="deleteSelection"/);
});
