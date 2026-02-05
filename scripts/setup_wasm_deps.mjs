// Script to setup WASM dependencies
// Reference: chili3d/scripts/setup_wasm_deps.mjs

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CPP_ROOT = path.resolve(__dirname, '../packages/geo/cpp');
const BUILD_DIR = path.resolve(CPP_ROOT, 'build');

const EMSDK_DIR_NAME = 'emsdk';
const EMSDK_DIR = path.resolve(BUILD_DIR, EMSDK_DIR_NAME);

const OCCT_DIR_NAME = 'occt';
const OCCT_DIR = path.resolve(BUILD_DIR, OCCT_DIR_NAME);

/**
 * @param {string} cmd
 */
async function execAsync(cmd) {
    console.log(`> ${cmd}`);
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                console.error('error: ', stderr);
                reject(err);
                return;
            }
            if (stderr) {
                console.error('stderr: ', stderr);
            }
            console.log('stdout: ', stdout);
            resolve(stdout);
        });
    });
}

/**
 * Fix emscripten.py to add --skipLibCheck for WebXR error
 */
async function fixEmscripten() {
    const file = path.resolve(EMSDK_DIR, 'upstream/emscripten/tools/emscripten.py');
    if (!fs.existsSync(file)) {
        console.log('emscripten.py not found, skipping fix');
        return;
    }
    let contents = fs.readFileSync(file, 'utf8');
    if (contents.includes('--skipLibCheck')) {
        console.log('emscripten.py already fixed');
        return;
    }
    contents = contents.replace(
        `cmd = tsc + ['--outFile', tsc_output_file, '--declaration', '--emitDeclarationOnly', '--allowJs', js_doc_file]`,
        `cmd = tsc + ['--outFile', tsc_output_file, '--declaration', '--skipLibCheck', '--emitDeclarationOnly', '--allowJs', js_doc_file]`,
    );
    fs.writeFileSync(file, contents, 'utf8');
    console.log('Fixed emscripten.py');
}

const libs = [
    {
        name: 'emscripten',
        url: 'https://github.com/emscripten-core/emsdk.git',
        tag: '4.0.8',
        dir: EMSDK_DIR,
        actions: [fixEmscripten],
        commands: [
            `${EMSDK_DIR}/emsdk install latest`,
            `${EMSDK_DIR}/emsdk activate --embedded latest`,
            `cd ${EMSDK_DIR}/upstream/emscripten && npm i`,
        ],
    },
    {
        name: 'occt',
        url: 'https://github.com/Open-Cascade-SAS/OCCT.git',
        tag: 'V8_0_0_rc3',
        dir: OCCT_DIR,
        actions: [],
        commands: [],
    },
];

async function cloneLibIfNotExists(lib) {
    if (!fs.existsSync(lib.dir)) {
        console.log(`Cloning ${lib.name}...`);
        await execAsync(`git clone --depth=1 -b ${lib.tag} ${lib.url} ${lib.dir}`);

        if (!fs.existsSync(lib.dir)) {
            console.error(`Failed to clone ${lib.name}`);
            process.exit(1);
        }
    } else {
        console.log(`${lib.name} already exists, skipping clone...`);
    }
}

async function setupLibs() {
    for (const lib of libs) {
        await cloneLibIfNotExists(lib);

        console.log(`Setting up ${lib.name}...`);

        for (const command of lib.commands) {
            await execAsync(command);
        }
        for (const action of lib.actions) {
            await action();
        }
    }
}

async function main() {
    console.log('=== Setting up WASM dependencies ===\n');
    console.log(`CPP_ROOT: ${CPP_ROOT}`);
    console.log(`BUILD_DIR: ${BUILD_DIR}`);

    if (!fs.existsSync(BUILD_DIR)) {
        fs.mkdirSync(BUILD_DIR, { recursive: true });
    }

    await setupLibs();

    console.log('\n=== Setup complete ===');
    console.log('\nNext steps:');
    console.log('1. Run build script: pnpm build:wasm');
    console.log('2. Or manually: cd packages/geo/cpp && cmake --preset release && cmake --build --preset release');
}

main().catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
});
