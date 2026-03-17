import { build } from 'esbuild';
import { createServer } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const standaloneDir = path.join(distDir, 'standalone');
const browserHostEntry = path.join(repoRoot, 'src', 'standalone', 'browserHost.ts');
const htmlFactoryEntry = path.join(
    repoRoot,
    'src',
    'standalone',
    'createStandaloneCadEditorHtml.ts'
);
const browserHostOutfile = path.join(standaloneDir, 'browserHost.js');
const htmlFactoryOutfile = path.join(standaloneDir, 'createStandaloneCadEditorHtml.mjs');
const standaloneHtmlOutfile = path.join(standaloneDir, 'index.html');

const args = parseArgs(process.argv.slice(2));
const host = args.host ?? '127.0.0.1';
const port = Number(args.port ?? process.env.PORT ?? '4174');
const prepareOnly = Boolean(args['prepare-only']);

if (!Number.isInteger(port) || port <= 0) {
    console.error(`Invalid port: ${args.port ?? process.env.PORT ?? ''}`);
    process.exit(1);
}

await ensureWebviewBuildArtifacts();
await prepareStandaloneAssets();

if (prepareOnly) {
    console.log(
        `Prepared standalone web assets at ${path.relative(repoRoot, standaloneHtmlOutfile)}`
    );
    process.exit(0);
}

const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url ?? '/', `http://${host}:${port}`);
        const requestPath = normalizeRequestPath(url.pathname);
        const targetPath = await resolveTargetPath(requestPath);
        const file = await readFile(targetPath);

        response.writeHead(200, {
            'Content-Type': getContentType(targetPath),
            'Cache-Control': 'no-store'
        });
        response.end(file);
    } catch (error) {
        response.statusCode =
            error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
                ? 404
                : 500;
        response.end(response.statusCode === 404 ? 'Not Found' : 'Internal Server Error');
    }
});

server.listen(port, host, () => {
    console.log(`CadToolOnline standalone web server: http://${host}:${port}/`);
    console.log(`Direct entry: http://${host}:${port}/dist/standalone/index.html`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        server.close(() => process.exit(0));
    });
}

async function ensureWebviewBuildArtifacts() {
    const requiredFiles = [
        path.join(distDir, 'webview', 'webview.js'),
        path.join(distDir, 'wasm', 'cad-geo.js'),
        path.join(distDir, 'wasm', 'cad-geo.wasm')
    ];

    for (const file of requiredFiles) {
        try {
            await access(file);
        } catch {
            throw new Error(
                `Missing build artifact: ${path.relative(repoRoot, file)}. Run "pnpm build:webview" first.`
            );
        }
    }
}

async function prepareStandaloneAssets() {
    await mkdir(standaloneDir, { recursive: true });

    await build({
        bundle: true,
        entryPoints: [browserHostEntry],
        format: 'esm',
        outfile: browserHostOutfile,
        platform: 'browser',
        sourcemap: true,
        target: ['chrome120', 'firefox120', 'safari17']
    });

    await build({
        bundle: true,
        entryPoints: [htmlFactoryEntry],
        format: 'esm',
        outfile: htmlFactoryOutfile,
        platform: 'node',
        target: ['node18']
    });

    const cacheBust = `?t=${Date.now()}`;
    const htmlFactoryModule = await import(pathToFileURL(htmlFactoryOutfile).href + cacheBust);
    const html = htmlFactoryModule.createStandaloneCadEditorHtml({
        browserHostScriptUri: '/dist/standalone/browserHost.js',
        iconsBaseUri: '/dist/webview/icons/svg/32',
        wasmBaseUri: '/dist/wasm',
        webviewScriptUri: '/dist/webview/webview.js'
    });
    await writeFile(standaloneHtmlOutfile, html, 'utf8');
}

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg.startsWith('--')) {
            continue;
        }
        const key = arg.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed[key] = true;
            continue;
        }
        parsed[key] = next;
        index += 1;
    }
    return parsed;
}

function normalizeRequestPath(requestPath) {
    if (!requestPath || requestPath === '/') {
        return '/dist/standalone/index.html';
    }
    return requestPath;
}

async function resolveTargetPath(requestPath) {
    const decodedPath = decodeURIComponent(requestPath);
    const relativePath = decodedPath.replace(/^\/+/, '');
    const fullPath = path.resolve(repoRoot, relativePath);
    const relativeToRoot = path.relative(repoRoot, fullPath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
        throw new Error('Path escapes repository root');
    }

    const info = await stat(fullPath);
    if (info.isDirectory()) {
        const nestedIndex = path.join(fullPath, 'index.html');
        await access(nestedIndex);
        return nestedIndex;
    }
    return fullPath;
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html':
            return 'text/html; charset=utf-8';
        case '.js':
        case '.mjs':
            return 'text/javascript; charset=utf-8';
        case '.css':
            return 'text/css; charset=utf-8';
        case '.json':
        case '.map':
            return 'application/json; charset=utf-8';
        case '.svg':
            return 'image/svg+xml';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.wasm':
            return 'application/wasm';
        default:
            return 'application/octet-stream';
    }
}
