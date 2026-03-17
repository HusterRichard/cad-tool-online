type VsCodeMessage = {
    command?: string;
    action?: string;
    data?: unknown;
    fileName?: string;
    level?: 'info' | 'warning' | 'error';
    text?: string;
    detail?: string;
    params?: Record<string, unknown>;
};

type VsCodeApi = {
    getState(): unknown;
    postMessage(message: unknown): void;
    setState(state: unknown): void;
};

declare global {
    interface Window {
        __cadtoolStandalone?: {
            dispatch(message: Record<string, unknown>): void;
            loadCadtoolConfig(fileName: string, data: unknown): void;
            loadStepFile(fileName: string, fileContent: ArrayBuffer | Uint8Array): void;
        };
        acquireVsCodeApi?: () => VsCodeApi;
    }
}

const STATE_STORAGE_KEY = 'cadtool-online:standalone-state';
const TOAST_CONTAINER_ID = 'cadtool-standalone-toast-container';

let cachedState = readStoredState();
let webviewReady = false;
let autoLoadScheduled = false;
const pendingMessages: Array<Record<string, unknown>> = [];
const standaloneVsCodeApi = createVsCodeApi();

function readStoredState(): unknown {
    try {
        const raw = window.sessionStorage.getItem(STATE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
}

function persistState(state: unknown): void {
    cachedState = state;
    try {
        window.sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state ?? null));
    } catch {
        // Ignore storage failures in standalone mode.
    }
}

function createVsCodeApi(): VsCodeApi {
    return {
        getState() {
            return cachedState;
        },
        postMessage(message: unknown) {
            handleVsCodeMessage(message);
        },
        setState(state: unknown) {
            persistState(state);
        }
    };
}

window.acquireVsCodeApi = () => standaloneVsCodeApi;

window.__cadtoolStandalone = {
    dispatch(message) {
        dispatchToWebview(message);
    },
    loadCadtoolConfig(fileName, data) {
        dispatchToWebview({
            command: 'importCadtoolConfig',
            data,
            fileName
        });
    },
    loadStepFile(fileName, fileContent) {
        const bytes = fileContent instanceof Uint8Array ? fileContent : new Uint8Array(fileContent);
        dispatchToWebview({
            command: 'loadStepFile',
            fileContent: bytes,
            fileName
        });
    }
};

function dispatchToWebview(message: Record<string, unknown>): void {
    if (!webviewReady) {
        pendingMessages.push(message);
        return;
    }
    window.postMessage(message, window.location.origin);
}

function flushPendingMessages(): void {
    if (!webviewReady || pendingMessages.length === 0) {
        return;
    }
    while (pendingMessages.length > 0) {
        const next = pendingMessages.shift();
        if (!next) {
            continue;
        }
        window.postMessage(next, window.location.origin);
    }
}

function showToast(level: 'info' | 'warning' | 'error', text: string): void {
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = TOAST_CONTAINER_ID;
        Object.assign(container.style, {
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: '10000',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            pointerEvents: 'none'
        });
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const borderColor = level === 'error' ? '#dc2626' : level === 'warning' ? '#d97706' : '#2563eb';
    Object.assign(toast.style, {
        minWidth: '220px',
        maxWidth: '360px',
        padding: '10px 12px',
        borderRadius: '8px',
        borderLeft: `4px solid ${borderColor}`,
        background: 'rgba(31, 41, 55, 0.94)',
        color: '#f9fafb',
        fontSize: '12px',
        lineHeight: '1.5',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.28)'
    });
    toast.textContent = text;
    container.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
        if (container && container.childElementCount === 0) {
            container.remove();
        }
    }, 3200);
}

function notify(level: 'info' | 'warning' | 'error', text: string, detail?: string): void {
    const message = detail ? `${text}\n${detail}` : text;
    const method =
        level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    method(`[CadToolOnline][standalone] ${message}`);
    showToast(level, message);
}

function downloadTextFile(fileName: string, content: string): void {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
}

function pickFile(options: { accept: string; readAs: 'arrayBuffer' | 'text' }): Promise<{
    file: File;
    value: ArrayBuffer | string;
} | null> {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = options.accept;
        input.style.display = 'none';
        input.addEventListener(
            'change',
            async () => {
                const file = input.files?.[0];
                input.remove();
                if (!file) {
                    resolve(null);
                    return;
                }
                const value =
                    options.readAs === 'arrayBuffer' ? await file.arrayBuffer() : await file.text();
                resolve({ file, value });
            },
            { once: true }
        );
        document.body.appendChild(input);
        input.click();
    });
}

async function importStepFromPicker(): Promise<void> {
    const result = await pickFile({
        accept: '.step,.stp,.STEP,.STP',
        readAs: 'arrayBuffer'
    });
    if (!result || !(result.value instanceof ArrayBuffer)) {
        return;
    }
    dispatchToWebview({
        command: 'loadStepFile',
        fileContent: new Uint8Array(result.value),
        fileName: result.file.name
    });
}

async function importCadtoolConfigFromPicker(): Promise<void> {
    const result = await pickFile({
        accept: '.json,application/json',
        readAs: 'text'
    });
    if (!result || typeof result.value !== 'string') {
        return;
    }

    try {
        const parsed = JSON.parse(result.value) as unknown;
        dispatchToWebview({
            command: 'importCadtoolConfig',
            data: parsed,
            fileName: result.file.name
        });
    } catch (error) {
        notify(
            'error',
            'CADTool 配置导入失败。',
            error instanceof Error ? error.message : String(error)
        );
    }
}

function postMbsAction(action: string, extra?: Record<string, unknown>): void {
    dispatchToWebview({
        command: 'mbsAction',
        action,
        ...(extra ?? {})
    });
}

function handleRibbonAction(message: VsCodeMessage): void {
    const action = typeof message.action === 'string' ? message.action : '';
    switch (action) {
        case 'createGroup':
        case 'createChildGroup':
        case 'renameGroup':
        case 'moveToGroup':
        case 'ungroupGroup':
        case 'deleteSelection':
        case 'groupProperties':
        case 'createFrame':
        case 'createRefFrame':
        case 'createDesignPoint':
        case 'editFrame':
        case 'deleteFrame':
        case 'measureTool':
        case 'surfaceThicken':
        case 'planarRingProcess':
        case 'cleanGroup':
        case 'createDefaultGroup':
            postMbsAction(action);
            return;
        case 'createMotion_rotational':
            postMbsAction('createMotion', { motionType: 'rotational' });
            return;
        case 'createMotion_translational':
            postMbsAction('createMotion', { motionType: 'translational' });
            return;
        case 'motionProperties':
            postMbsAction('motionProperties');
            return;
        case 'createContact_pointPoint':
            postMbsAction('createContact', { contactType: 'pointPoint' });
            return;
        case 'createContact_pointSurface':
            postMbsAction('createContact', { contactType: 'pointSurface' });
            return;
        default:
            break;
    }

    if (action.startsWith('createJoint_')) {
        const jointType =
            typeof message.params?.jointType === 'string'
                ? message.params.jointType
                : action.replace('createJoint_', '');
        postMbsAction('createJoint', { jointType });
        return;
    }

    notify('warning', `未处理的 standalone ribbon 动作: ${action || '(empty)'}`);
}

function handleVsCodeMessage(message: unknown): void {
    if (!message || typeof message !== 'object') {
        return;
    }

    const payload = message as VsCodeMessage;
    switch (payload.command) {
        case 'alert':
            notify('info', String(payload.text ?? ''));
            return;
        case 'notify':
            notify(payload.level ?? 'info', String(payload.text ?? ''), payload.detail);
            return;
        case 'importStep':
            void importStepFromPicker();
            return;
        case 'exportModel':
            downloadTextFile(
                typeof payload.fileName === 'string' ? payload.fileName : 'model_export.json',
                typeof payload.data === 'string'
                    ? payload.data
                    : JSON.stringify(payload.data ?? {}, null, 2)
            );
            notify('info', '模型已导出到浏览器下载目录。');
            return;
        case 'exportCadtoolConfig':
            downloadTextFile(
                typeof payload.fileName === 'string' ? payload.fileName : 'cadtool.config.json',
                typeof payload.data === 'string'
                    ? payload.data
                    : JSON.stringify(payload.data ?? {}, null, 2)
            );
            notify('info', 'CADTool 配置已导出到浏览器下载目录。');
            return;
        case 'requestCadtoolConfigImport':
            void importCadtoolConfigFromPicker();
            return;
        case 'ribbonAction':
            handleRibbonAction(payload);
            return;
        case 'ready':
            webviewReady = true;
            flushPendingMessages();
            if (!autoLoadScheduled) {
                autoLoadScheduled = true;
                void autoLoadFromQuery();
            }
            return;
        case 'selectShape':
            return;
        default:
            return;
    }
}

function resolveFileName(urlLike: string): string {
    try {
        const url = new URL(urlLike, window.location.href);
        const parts = url.pathname.split('/');
        return parts[parts.length - 1] || 'download.dat';
    } catch {
        const parts = urlLike.split(/[\\/]/);
        return parts[parts.length - 1] || 'download.dat';
    }
}

async function autoLoadFromQuery(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const step = params.get('step');
    if (step) {
        try {
            const response = await fetch(step);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            dispatchToWebview({
                command: 'loadStepFile',
                fileContent: new Uint8Array(await response.arrayBuffer()),
                fileName: resolveFileName(step)
            });
            notify('info', `已自动加载 STEP: ${resolveFileName(step)}`);
        } catch (error) {
            notify(
                'error',
                `自动加载 STEP 失败: ${step}`,
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    const config = params.get('config');
    if (!config) {
        return;
    }
    try {
        const response = await fetch(config);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        dispatchToWebview({
            command: 'importCadtoolConfig',
            data: (await response.json()) as unknown,
            fileName: resolveFileName(config)
        });
        notify('info', `已自动加载配置: ${resolveFileName(config)}`);
    } catch (error) {
        notify(
            'error',
            `自动加载配置失败: ${config}`,
            error instanceof Error ? error.message : String(error)
        );
    }
}
