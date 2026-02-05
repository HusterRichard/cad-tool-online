// Script to setup WASM dependencies
// Reference: chili3d/scripts/setup_wasm_deps.mjs

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THIRD_PARTY_DIR = join(__dirname, '..', 'packages', 'chili-geo', 'cpp', 'third_party');

const OCCT_VERSION = 'V8_0_0_rc3';
const OCCT_REPO = 'https://github.com/nicholasdavies/opencascade.js';

async function setupOcctWasm() {
    console.log('Setting up OCCT WASM dependencies...');

    if (!existsSync(THIRD_PARTY_DIR)) {
        mkdirSync(THIRD_PARTY_DIR, { recursive: true });
    }

    const occtDir = join(THIRD_PARTY_DIR, 'occt-wasm');

    if (existsSync(occtDir)) {
        console.log('OCCT WASM already exists, skipping...');
        return;
    }

    console.log(`Downloading OCCT ${OCCT_VERSION}...`);
    console.log('Note: This requires manual setup. Please follow these steps:');
    console.log('');
    console.log('1. Clone opencascade.js repository:');
    console.log(`   git clone ${OCCT_REPO}`);
    console.log('');
    console.log('2. Build OCCT WASM following their instructions');
    console.log('');
    console.log('3. Copy the built files to:');
    console.log(`   ${occtDir}`);
    console.log('');
    console.log('Alternatively, use pre-built binaries from:');
    console.log('   https://github.com/nicholasdavies/opencascade.js/releases');
}

async function setupEigen() {
    console.log('Setting up Eigen...');

    const eigenDir = join(THIRD_PARTY_DIR, 'eigen');

    if (existsSync(eigenDir)) {
        console.log('Eigen already exists, skipping...');
        return;
    }

    console.log('Downloading Eigen...');
    try {
        execSync(`git clone --depth 1 https://gitlab.com/libeigen/eigen.git "${eigenDir}"`, {
            stdio: 'inherit'
        });
        console.log('Eigen downloaded successfully');
    } catch (error) {
        console.error('Failed to download Eigen:', error.message);
    }
}

async function main() {
    console.log('=== Setting up WASM dependencies ===\n');

    await setupOcctWasm();
    await setupEigen();

    console.log('\n=== Setup complete ===');
}

main().catch(console.error);
