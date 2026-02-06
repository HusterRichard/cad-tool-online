/**
 * 颜色工具函数测试
 *
 * 测试所有颜色转换和处理函数
 */

import { describe, it, expect } from 'vitest';
import {
    hexToNumber,
    numberToHex,
    rgbToHex,
    hexToRgb,
    isValidColor,
    interpolateColor,
    getDefaultColor,
    getHeatMapColor,
    ColorCache,
    MaterialColors,
    ColorThemes,
} from '../utils/color-utils';

describe('Color Utils', () => {
    describe('hexToNumber', () => {
        it('should convert hex string to number', () => {
            expect(hexToNumber('#FF5733')).toBe(0xFF5733);
            expect(hexToNumber('#000000')).toBe(0x000000);
            expect(hexToNumber('#FFFFFF')).toBe(0xFFFFFF);
            expect(hexToNumber('#808080')).toBe(0x808080);
        });

        it('should handle lowercase hex', () => {
            expect(hexToNumber('#ff5733')).toBe(0xFF5733);
            expect(hexToNumber('#abc123')).toBe(0xABC123);
        });
    });

    describe('numberToHex', () => {
        it('should convert number to hex string', () => {
            expect(numberToHex(0xFF5733)).toBe('#FF5733');
            expect(numberToHex(0x000000)).toBe('#000000');
            expect(numberToHex(0xFFFFFF)).toBe('#FFFFFF');
            expect(numberToHex(0x808080)).toBe('#808080');
        });

        it('should pad with zeros', () => {
            expect(numberToHex(0x0A)).toBe('#00000A');
            expect(numberToHex(0xFF)).toBe('#0000FF');
        });
    });

    describe('rgbToHex', () => {
        it('should convert RGB to hex', () => {
            expect(rgbToHex(255, 87, 51)).toBe('#FF5733');
            expect(rgbToHex(0, 0, 0)).toBe('#000000');
            expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF');
        });

        it('should clamp values to 0-255 range', () => {
            expect(rgbToHex(300, 100, 50)).toBe('#FF6432');
            expect(rgbToHex(-10, 100, 50)).toBe('#006432');
            expect(rgbToHex(255.7, 87.2, 51.9)).toBe('#FF5733');
        });
    });

    describe('hexToRgb', () => {
        it('should convert hex to RGB', () => {
            const rgb = hexToRgb('#FF5733');
            expect(rgb.r).toBe(255);
            expect(rgb.g).toBe(87);
            expect(rgb.b).toBe(51);
        });

        it('should handle edge cases', () => {
            const black = hexToRgb('#000000');
            expect(black).toEqual({ r: 0, g: 0, b: 0 });

            const white = hexToRgb('#FFFFFF');
            expect(white).toEqual({ r: 255, g: 255, b: 255 });
        });
    });

    describe('isValidColor', () => {
        it('should validate correct hex colors', () => {
            expect(isValidColor('#FF5733')).toBe(true);
            expect(isValidColor('#000000')).toBe(true);
            expect(isValidColor('#FFFFFF')).toBe(true);
            expect(isValidColor('#abc123')).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(isValidColor('FF5733')).toBe(false);    // missing #
            expect(isValidColor('#FFF')).toBe(false);       // 3 chars
            expect(isValidColor('#GGGGGG')).toBe(false);    // invalid chars
            expect(isValidColor('rgb(255,0,0)')).toBe(false);
            expect(isValidColor('')).toBe(false);
            expect(isValidColor('#12345')).toBe(false);     // 5 chars
            expect(isValidColor('#1234567')).toBe(false);   // 7 chars
        });
    });

    describe('interpolateColor', () => {
        it('should interpolate between two colors', () => {
            expect(interpolateColor('#000000', '#FFFFFF', 0)).toBe('#000000');
            expect(interpolateColor('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
            expect(interpolateColor('#000000', '#FFFFFF', 0.5)).toBe('#7F7F7F');
        });

        it('should interpolate RGB channels independently', () => {
            const mid = interpolateColor('#FF0000', '#0000FF', 0.5);
            const rgb = hexToRgb(mid);
            expect(rgb.r).toBeGreaterThan(0);
            expect(rgb.b).toBeGreaterThan(0);
        });
    });

    describe('getDefaultColor', () => {
        it('should return default gray color', () => {
            expect(getDefaultColor()).toBe('#808080');
        });
    });

    describe('getHeatMapColor', () => {
        it('should return blue for low values', () => {
            const color = getHeatMapColor(0);
            const rgb = hexToRgb(color);
            expect(rgb.b).toBeGreaterThan(200); // 主要是蓝色
        });

        it('should return red for high values', () => {
            const color = getHeatMapColor(1);
            const rgb = hexToRgb(color);
            expect(rgb.r).toBeGreaterThan(200); // 主要是红色
        });

        it('should return green for medium values', () => {
            const color = getHeatMapColor(0.5);
            const rgb = hexToRgb(color);
            expect(rgb.g).toBeGreaterThan(200); // 主要是绿色
        });

        it('should clamp values to 0-1 range', () => {
            expect(() => getHeatMapColor(-0.5)).not.toThrow();
            expect(() => getHeatMapColor(1.5)).not.toThrow();
            expect(isValidColor(getHeatMapColor(-0.5))).toBe(true);
            expect(isValidColor(getHeatMapColor(1.5))).toBe(true);
        });
    });

    describe('ColorCache', () => {
        it('should cache color conversions', () => {
            const cache = new ColorCache();
            const color1 = cache.get('#FF5733');
            const color2 = cache.get('#FF5733');

            expect(color1).toBe(color2);
            expect(color1).toBe(0xFF5733);
            expect(cache.size).toBe(1);
        });

        it('should clear cache', () => {
            const cache = new ColorCache();
            cache.get('#FF5733');
            cache.get('#3498DB');

            expect(cache.size).toBe(2);

            cache.clear();
            expect(cache.size).toBe(0);
        });

        it('should cache multiple colors', () => {
            const cache = new ColorCache();
            cache.get('#FF5733');
            cache.get('#3498DB');
            cache.get('#2ECC71');

            expect(cache.size).toBe(3);
        });
    });

    describe('MaterialColors', () => {
        it('should have predefined material colors', () => {
            expect(MaterialColors.steel).toBe('#C0C0C0');
            expect(MaterialColors.aluminum).toBe('#D3D3D3');
            expect(MaterialColors.copper).toBe('#B87333');
            expect(MaterialColors.default).toBe('#808080');
        });

        it('should have valid color formats', () => {
            Object.values(MaterialColors).forEach(color => {
                expect(isValidColor(color)).toBe(true);
            });
        });
    });

    describe('ColorThemes', () => {
        it('should have predefined themes', () => {
            expect(ColorThemes.default).toBeDefined();
            expect(ColorThemes.vibrant).toBeDefined();
            expect(ColorThemes.monochrome).toBeDefined();
            expect(ColorThemes.pastel).toBeDefined();
        });

        it('should have assembly, part, and solid colors in each theme', () => {
            Object.values(ColorThemes).forEach(theme => {
                expect(theme.assembly).toBeDefined();
                expect(theme.part).toBeDefined();
                expect(theme.solid).toBeDefined();
            });
        });

        it('should have valid color formats in all themes', () => {
            Object.values(ColorThemes).forEach(theme => {
                expect(isValidColor(theme.assembly)).toBe(true);
                expect(isValidColor(theme.part)).toBe(true);
                expect(isValidColor(theme.solid)).toBe(true);
            });
        });
    });

    describe('Roundtrip Conversions', () => {
        it('should preserve color through hex -> number -> hex', () => {
            const original = '#FF5733';
            const num = hexToNumber(original);
            const back = numberToHex(num);
            expect(back).toBe(original);
        });

        it('should preserve color through RGB -> hex -> RGB', () => {
            const original = { r: 255, g: 87, b: 51 };
            const hex = rgbToHex(original.r, original.g, original.b);
            const back = hexToRgb(hex);
            expect(back).toEqual(original);
        });

        it('should preserve multiple colors', () => {
            const colors = ['#FF5733', '#3498DB', '#2ECC71', '#000000', '#FFFFFF'];

            colors.forEach(color => {
                const num = hexToNumber(color);
                const back = numberToHex(num);
                expect(back).toBe(color);
            });
        });
    });

    describe('Performance', () => {
        it('should convert colors quickly', () => {
            const iterations = 10000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                hexToNumber('#FF5733');
                numberToHex(0xFF5733);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // 10000 次转换应该在 50ms 内完成
            expect(duration).toBeLessThan(50);
        });

        it('should benefit from caching', () => {
            const cache = new ColorCache();
            const iterations = 10000;
            const colors = ['#FF5733', '#3498DB', '#2ECC71'];

            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                colors.forEach(color => cache.get(color));
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // 缓存版本应该很快
            expect(duration).toBeLessThan(100);
            expect(cache.size).toBe(3); // 只有 3 个唯一颜色
        });
    });
});
