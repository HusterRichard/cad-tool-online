import { describe, expect, it } from 'vitest';

import {
    createCadtoolErrorNotification,
    formatCadtoolNotificationMessage,
    getCadtoolErrorDefinition,
    isCadtoolErrorCode
} from '../src/cadtoolErrors';

describe('cadtoolErrors', () => {
    it('recognizes official CADTool error codes', () => {
        expect(isCadtoolErrorCode('ERR_RUNTIME')).toBe(true);
        expect(isCadtoolErrorCode('NOT_A_REAL_CODE')).toBe(false);
    });

    it('returns official error metadata', () => {
        const definition = getCadtoolErrorDefinition('ERR_OPEN_CAD_FILE_FAILED');

        expect(definition.title).toBe('打开 CAD 文件失败');
        expect(definition.docPath).toContain('Error4.html');
        expect(definition.level).toBe('error');
    });

    it('creates structured runtime notifications from error codes', () => {
        const notification = createCadtoolErrorNotification('ERR_GENERATE_FILE_FAILED', {
            detail: 'Permission denied'
        });

        expect(notification).toMatchObject({
            level: 'error',
            code: 'ERR_GENERATE_FILE_FAILED',
            text: 'Failed to generate the requested output file.',
            detail: 'Permission denied'
        });
        expect(notification.recoveryHint).toContain('output path');
    });

    it('formats notifications for UI presentation', () => {
        const notification = createCadtoolErrorNotification('PARSE_FILE_FAILED', {
            detail: 'Unexpected token near line 1'
        });

        expect(
            formatCadtoolNotificationMessage(notification, {
                includeDetail: true,
                includeRecoveryHint: true
            })
        ).toContain('[PARSE_FILE_FAILED] Failed to parse the input file. Detail: Unexpected token near line 1');
    });
});
