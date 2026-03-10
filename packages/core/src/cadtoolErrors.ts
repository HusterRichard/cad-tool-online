export type CadtoolNotificationLevel = 'info' | 'warning' | 'error';

export type CadtoolErrorCode =
    | 'ERR_CAD_SOFTWARE_NOT_INSTALLED'
    | 'ERR_CAD_VERSION_TOO_LOW'
    | 'ERR_OPEN_CAD_SOFTWARE_FAILED'
    | 'ERR_OPEN_CAD_FILE_FAILED'
    | 'CAD_FILE_IS_EMPTY'
    | 'PARSE_FILE_FAILED'
    | 'ERR_EXPORT_STEP_FAILED'
    | 'ERR_GENERATE_FILE_FAILED'
    | 'ERR_RUNTIME'
    | 'PARSER_PATH_INVALID'
    | 'ERR_CREATE_PROCESS_FAILED'
    | 'ERR_DATA_EXCHANGE_FAILED';

export interface CadtoolErrorDefinition {
    code: CadtoolErrorCode;
    title: string;
    level: Extract<CadtoolNotificationLevel, 'warning' | 'error'>;
    defaultMessage: string;
    recoveryHint: string;
    docPath: string;
}

export interface CadtoolRuntimeNotification {
    level: CadtoolNotificationLevel;
    text: string;
    code?: CadtoolErrorCode;
    title?: string;
    detail?: string;
    recoveryHint?: string;
    docPath?: string;
}

const ERROR_REFERENCE_ROOT = 'ref/Docs/CADToolBox/Doc/CADToolBox/FAQ/ErrorReference';

export const CADTOOL_ERROR_DEFINITIONS: Record<CadtoolErrorCode, CadtoolErrorDefinition> = {
    ERR_CAD_SOFTWARE_NOT_INSTALLED: {
        code: 'ERR_CAD_SOFTWARE_NOT_INSTALLED',
        title: '未安装 CAD 软件',
        level: 'error',
        defaultMessage: 'Required CAD software is not installed.',
        recoveryHint: 'Install the required CAD software or switch to a supported neutral-format import flow.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error1.html`
    },
    ERR_CAD_VERSION_TOO_LOW: {
        code: 'ERR_CAD_VERSION_TOO_LOW',
        title: 'CAD 软件版本过低',
        level: 'error',
        defaultMessage: 'The detected CAD software version is lower than the supported minimum.',
        recoveryHint: 'Upgrade the CAD software version or use a matching parser/runtime.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error2.html`
    },
    ERR_OPEN_CAD_SOFTWARE_FAILED: {
        code: 'ERR_OPEN_CAD_SOFTWARE_FAILED',
        title: '启动 CAD 软件失败',
        level: 'error',
        defaultMessage: 'Failed to launch the CAD software process.',
        recoveryHint: 'Check the local installation, launch permissions, and parser configuration.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error3.html`
    },
    ERR_OPEN_CAD_FILE_FAILED: {
        code: 'ERR_OPEN_CAD_FILE_FAILED',
        title: '打开 CAD 文件失败',
        level: 'error',
        defaultMessage: 'Failed to open the selected CAD file.',
        recoveryHint: 'Verify the file exists, is readable, and matches a supported format.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error4.html`
    },
    CAD_FILE_IS_EMPTY: {
        code: 'CAD_FILE_IS_EMPTY',
        title: 'CAD 文件为空',
        level: 'warning',
        defaultMessage: 'The selected CAD file does not contain any usable model data.',
        recoveryHint: 'Check whether the source file exported successfully and contains geometry.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error5.html`
    },
    PARSE_FILE_FAILED: {
        code: 'PARSE_FILE_FAILED',
        title: '文件解析失败',
        level: 'error',
        defaultMessage: 'Failed to parse the input file.',
        recoveryHint: 'Validate the file content and try a known-good sample to isolate the issue.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error6.html`
    },
    ERR_EXPORT_STEP_FAILED: {
        code: 'ERR_EXPORT_STEP_FAILED',
        title: 'STEP 导出失败',
        level: 'error',
        defaultMessage: 'Failed to export the STEP file.',
        recoveryHint: 'Check write permissions, output path validity, and model data integrity.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error7.html`
    },
    ERR_GENERATE_FILE_FAILED: {
        code: 'ERR_GENERATE_FILE_FAILED',
        title: '生成文件失败',
        level: 'error',
        defaultMessage: 'Failed to generate the requested output file.',
        recoveryHint: 'Check output path permissions and verify that the generated data is serializable.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error8.html`
    },
    ERR_RUNTIME: {
        code: 'ERR_RUNTIME',
        title: '运行时异常',
        level: 'error',
        defaultMessage: 'A runtime error interrupted the current operation.',
        recoveryHint: 'Retry the operation and inspect the latest error detail to isolate the failing step.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error9.html`
    },
    PARSER_PATH_INVALID: {
        code: 'PARSER_PATH_INVALID',
        title: '解析器路径无效',
        level: 'error',
        defaultMessage: 'The configured parser path is invalid.',
        recoveryHint: 'Check parser executable settings and confirm the configured path exists.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error10.html`
    },
    ERR_CREATE_PROCESS_FAILED: {
        code: 'ERR_CREATE_PROCESS_FAILED',
        title: '创建进程失败',
        level: 'error',
        defaultMessage: 'Failed to create a required subprocess.',
        recoveryHint: 'Check runtime environment permissions and external tool availability.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error11.html`
    },
    ERR_DATA_EXCHANGE_FAILED: {
        code: 'ERR_DATA_EXCHANGE_FAILED',
        title: '数据交换失败',
        level: 'error',
        defaultMessage: 'Data exchange with an external tool failed.',
        recoveryHint: 'Retry with a smaller sample and verify parser, CAD tool, and file compatibility.',
        docPath: `${ERROR_REFERENCE_ROOT}/Error12.html`
    }
};

export function isCadtoolErrorCode(value: string): value is CadtoolErrorCode {
    return value in CADTOOL_ERROR_DEFINITIONS;
}

export function getCadtoolErrorDefinition(code: CadtoolErrorCode): CadtoolErrorDefinition {
    return CADTOOL_ERROR_DEFINITIONS[code];
}

export function createCadtoolErrorNotification(
    code: CadtoolErrorCode,
    options: {
        detail?: string;
        text?: string;
        level?: CadtoolNotificationLevel;
    } = {}
): CadtoolRuntimeNotification {
    const definition = getCadtoolErrorDefinition(code);

    return {
        level: options.level ?? definition.level,
        code,
        title: definition.title,
        text: options.text ?? definition.defaultMessage,
        detail: options.detail,
        recoveryHint: definition.recoveryHint,
        docPath: definition.docPath
    };
}

export function formatCadtoolNotificationMessage(
    notification: CadtoolRuntimeNotification,
    options: {
        includeDetail?: boolean;
        includeRecoveryHint?: boolean;
    } = {}
): string {
    const parts: string[] = [];

    if (notification.code) {
        parts.push(`[${notification.code}]`);
    }

    parts.push(notification.text);

    if (options.includeDetail && notification.detail) {
        parts.push(`Detail: ${notification.detail}`);
    }

    if (options.includeRecoveryHint && notification.recoveryHint) {
        parts.push(`Hint: ${notification.recoveryHint}`);
    }

    return parts.join(' ');
}
