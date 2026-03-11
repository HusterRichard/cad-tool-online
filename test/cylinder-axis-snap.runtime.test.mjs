import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { extname, join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const wasmDir = 'C:/11.gitlab/CadToolOnline/packages/geo/wasm';

function startWasmServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const filePath = join(wasmDir, url.pathname.replace(/^\//, ''));
      const data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': ext === '.wasm' ? 'application/wasm' : 'text/javascript' });
      res.end(data);
    } catch (error) {
      res.writeHead(404);
      res.end(String(error));
    }
  });

  return new Promise((resolve) => {
    server.listen(8123, '127.0.0.1', () => resolve(server));
  });
}

test('cylinder face snapping returns an axis-aligned snap point on the hovered section', async () => {
  const server = await startWasmServer();
  try {
    const factory = (await import(pathToFileURL(`${wasmDir}/cad-geo.js`).href)).default;
    const mod = await factory({ locateFile: (path) => `http://127.0.0.1:8123/${path}` });
    const shapeId = mod.makeCylinder(5, 20, 'runtime-hover-cylinder');
    const result = JSON.parse(mod.getFaceNormalAtPoint(shapeId, 10, 0, 12, -1, 0, 0));

    assert.equal(result.snapKind, 'cylinder-axis');
    assert.deepEqual(result.snapDirection, { x: 0, y: 0, z: 1 });
    assert.equal(result.snapConfidence, 1);
    assert.deepEqual(result.snapPoint, { x: 0, y: 0, z: 12 });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
