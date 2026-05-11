import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

function run(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            ...options,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) {
                resolve({ stderr, stdout });
                return;
            }
            reject(
                new Error(
                    `Command failed (${command} ${args.join(' ')}):\n${stdout}\n${stderr}`.trim()
                )
            );
        });
    });
}

test('standalone web prepare emits a browser entry that wires the host stub and built webview', async () => {
    const cwd = fileURLToPath(new URL('..', import.meta.url));
    if (process.platform === 'win32') {
        await run('cmd.exe', ['/d', '/s', '/c', 'pnpm web:prepare'], { cwd });
    } else {
        await run('pnpm', ['web:prepare'], { cwd });
    }

    const htmlPath = new URL('../dist/standalone/index.html', import.meta.url);
    const browserHostPath = new URL('../dist/standalone/browserHost.js', import.meta.url);
    const html = await readFile(htmlPath, 'utf8');
    const browserHostStats = await stat(browserHostPath);

    assert.ok(browserHostStats.size > 0, 'expected browserHost.js to be emitted');
    assert.match(
        html,
        /<script type="module" src="\/dist\/standalone\/browserHost\.js"><\/script>/
    );
    assert.match(html, /<script type="module" src="\/dist\/webview\/webview\.js"><\/script>/);
    assert.match(html, /window\.WASM_BASE_URL = "\/dist\/wasm";/);
    assert.match(html, /window\.ICONS_32_BASE = "\/dist\/webview\/icons\/svg\/32";/);
});

test('standalone SC36 export prepares the target during the click gesture', async () => {
    const browserHostSourcePath = new URL('../src/standalone/browserHost.ts', import.meta.url);
    const mainSourcePath = new URL('../src/webview/main.ts', import.meta.url);
    const [browserHostSource, mainSource] = await Promise.all([
        readFile(browserHostSourcePath, 'utf8'),
        readFile(mainSourcePath, 'utf8')
    ]);

    assert.match(mainSource, /command: 'prepareModelicaPackageExport'/);
    assert.match(mainSource, /void exportModelicaPackage\(\);/);

    assert.match(browserHostSource, /case 'prepareModelicaPackageExport':/);
    assert.match(browserHostSource, /pendingModelicaPackageExportTarget/);
    assert.match(browserHostSource, /await preparedTargetPromise/);
    assert.match(browserHostSource, /showDirectoryPicker/);
    assert.match(browserHostSource, /getDirectoryHandle\('Visualizers', \{ create: true \}\)/);
    assert.match(browserHostSource, /SC36 export completed:/);
    assert.doesNotMatch(browserHostSource, /does not support SC36 package export yet/);
});
