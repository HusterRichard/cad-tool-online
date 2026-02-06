/**
 * 颜色工具函数库
 *
 * 提供颜色格式转换、验证和操作的实用工具
 */

/**
 * 十六进制字符串转数值
 * @param hex 十六进制颜色字符串 (例: "#FF5733")
 * @returns 数值颜色 (例: 0xFF5733)
 */
export function hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

/**
 * 数值转十六进制字符串
 * @param num 数值颜色 (例: 0xFF5733)
 * @returns 十六进制字符串 (例: "#FF5733")
 */
export function numberToHex(num: number): string {
    return '#' + num.toString(16).padStart(6, '0').toUpperCase();
}

/**
 * RGB 分量转十六进制
 * @param r 红色分量 (0-255)
 * @param g 绿色分量 (0-255)
 * @param b 蓝色分量 (0-255)
 * @returns 十六进制字符串 (例: "#FF5733")
 */
export function rgbToHex(r: number, g: number, b: number): string {
    // 确保值在有效范围内
    r = Math.max(0, Math.min(255, Math.floor(r)));
    g = Math.max(0, Math.min(255, Math.floor(g)));
    b = Math.max(0, Math.min(255, Math.floor(b)));

    return '#' +
        r.toString(16).padStart(2, '0').toUpperCase() +
        g.toString(16).padStart(2, '0').toUpperCase() +
        b.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * 十六进制转 RGB 分量
 * @param hex 十六进制颜色字符串 (例: "#FF5733")
 * @returns RGB 对象 {r, g, b}
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const num = parseInt(hex.replace('#', ''), 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
    };
}

/**
 * 验证颜色格式是否有效
 * @param color 颜色字符串
 * @returns 是否为有效的十六进制颜色
 */
export function isValidColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
}

/**
 * 颜色插值（用于动画）
 * @param color1 起始颜色
 * @param color2 结束颜色
 * @param t 插值因子 (0-1)
 * @returns 插值后的颜色
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    const r = Math.floor(rgb1.r + (rgb2.r - rgb1.r) * t);
    const g = Math.floor(rgb1.g + (rgb2.g - rgb1.g) * t);
    const b = Math.floor(rgb1.b + (rgb2.b - rgb1.b) * t);

    return rgbToHex(r, g, b);
}

/**
 * 获取默认颜色（当没有颜色信息时）
 * @returns 默认灰色
 */
export function getDefaultColor(): string {
    return '#808080';
}

/**
 * 生成热力图颜色
 * @param value 数值 (0-1)
 * @returns 热力图颜色 (蓝 → 绿 → 黄 → 红)
 */
export function getHeatMapColor(value: number): string {
    // 确保值在 0-1 范围内
    const normalized = Math.max(0, Math.min(1, value));

    let r: number, g: number, b: number;

    if (normalized < 0.25) {
        // 蓝 → 青
        const t = normalized / 0.25;
        r = 0;
        g = Math.floor(t * 255);
        b = 255;
    } else if (normalized < 0.5) {
        // 青 → 绿
        const t = (normalized - 0.25) / 0.25;
        r = 0;
        g = 255;
        b = Math.floor((1 - t) * 255);
    } else if (normalized < 0.75) {
        // 绿 → 黄
        const t = (normalized - 0.5) / 0.25;
        r = Math.floor(t * 255);
        g = 255;
        b = 0;
    } else {
        // 黄 → 红
        const t = (normalized - 0.75) / 0.25;
        r = 255;
        g = Math.floor((1 - t) * 255);
        b = 0;
    }

    return rgbToHex(r, g, b);
}

/**
 * 颜色缓存类（提升性能）
 */
export class ColorCache {
    private cache = new Map<string, number>();

    /**
     * 获取缓存的数值颜色
     * @param hex 十六进制颜色字符串
     * @returns 数值颜色
     */
    get(hex: string): number {
        if (!this.cache.has(hex)) {
            this.cache.set(hex, hexToNumber(hex));
        }
        return this.cache.get(hex)!;
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * 获取缓存大小
     */
    get size(): number {
        return this.cache.size;
    }
}

/**
 * 材质颜色预设
 */
export const MaterialColors = {
    // 金属
    steel: '#C0C0C0',      // 钢
    aluminum: '#D3D3D3',   // 铝
    copper: '#B87333',     // 铜
    brass: '#B5A642',      // 黄铜
    gold: '#FFD700',       // 金

    // 塑料
    plastic_blue: '#3498DB',
    plastic_red: '#E74C3C',
    plastic_green: '#2ECC71',
    plastic_white: '#ECF0F1',
    plastic_black: '#2C3E50',

    // 橡胶
    rubber_black: '#1A1A1A',
    rubber_gray: '#4A4A4A',

    // 其他
    glass: '#E8F8F5',      // 玻璃
    wood: '#8B4513',       // 木材
    default: '#808080',    // 默认灰色
} as const;

/**
 * 颜色主题预设
 */
export const ColorThemes = {
    default: {
        assembly: '#C0C0C0',
        part: '#808080',
        solid: '#606060',
    },
    vibrant: {
        assembly: '#E74C3C',
        part: '#3498DB',
        solid: '#2ECC71',
    },
    monochrome: {
        assembly: '#FFFFFF',
        part: '#CCCCCC',
        solid: '#999999',
    },
    pastel: {
        assembly: '#F8B4D9',
        part: '#B4E7F8',
        solid: '#C8F8B4',
    },
} as const;

export type ColorThemeName = keyof typeof ColorThemes;
