import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../../src/webview/main.ts', import.meta.url), 'utf8');

describe('SC01 contact workflow source coverage', () => {
    it('guards contact creation when no model is loaded', () => {
        expect(source).toMatch(/function startContactCreation\(contactType: ContactType\): void \{/);
        expect(source).toMatch(/if \(loadedShapes\.size === 0\) \{/);
        expect(source).toMatch(/text: 'Please load a model first'/);
        expect(source).toMatch(/setStatusInfo\('Load a model before creating contacts'\);/);
    });

    it('keeps fast and standard contact creation modes in the options panel', () => {
        expect(source).toMatch(/function renderContactOptionsPanel\(\): void \{/);
        expect(source).toMatch(/setPanelMode\('options', '选项-接触'\);/);
        expect(source).toMatch(/contactCreationMode === 'standard'/);
        expect(source).toMatch(/⚡ 闪电模式/);
        expect(source).toMatch(/📐 标准模式/);
        expect(source).toMatch(/支持 Alt \+ 鼠标滚轮快速调节图标大小/);
    });

    it('persists contacts through config import and export', () => {
        expect(source).toMatch(/const contacts = getConfigArray\(data, 'contact', stats\);/);
        expect(source).toMatch(/contact: Array\.from\(mbsContacts\.values\(\)\)\.map\(\(contact\) => \(\{/);
        expect(source).toMatch(/partA: resolvePartRefName\(contact\.partA\),/);
        expect(source).toMatch(/partB: resolvePartRefName\(contact\.partB\),/);
        expect(source).toMatch(/contactType: contact\.contactType/);
    });

    it('supports contact selection highlights and deletion lifecycle', () => {
        expect(source).toMatch(/applyShapeVisualColor\(contact\.partA, '#DC2626'\);/);
        expect(source).toMatch(/applyShapeVisualColor\(contact\.partB, '#2563EB'\);/);
        expect(source).toMatch(/function deleteContactById\(contactId: string\): boolean \{/);
        expect(source).toMatch(/setStatusInfo\(`Contact deleted: \$\{contact\.name\}`\);/);
    });
});
