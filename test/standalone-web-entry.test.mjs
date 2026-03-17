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
