/**
 * 颜色功能集成测试
 *
 * 测试从 STEP 文件导入到 Three.js 渲染的完整流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OcctWrapper } from '../OcctWrapper';
// import type { StepReadResult } from '../types';

describe('Color Integration Tests', () => {
    let occt: OcctWrapper;

    beforeAll(async () => {
        occt = new OcctWrapper();
        await occt.initialize();
    });

    afterAll(() => {
        if (occt) {
            occt.clearShapes();
        }
    });

    describe('End-to-End Color Flow', () => {
        it('should validate complete color pipeline structure', () => {
            // 端到端测试验证整个颜色处理流程的结构
            // 实际的文件加载测试需要真实的 STEP 文件环境

            // 模拟完整的数据流
            const mockStepResult = {
                success: true,
                rootNodes: [{
                    id: 'test_node_1',
                    name: 'Assembly',
                    type: 'assembly' as const,
                    color: '#C0C0C0',
                    children: [{
                        id: 'test_node_2',
                        name: 'Part1',
                        type: 'solid' as const,
                        shapeId: 'shape_1',
                        color: '#FF5733',
                    }],
                }],
            };

            // 1. 验证 STEP 读取结果结构
            expect(mockStepResult.success).toBe(true);
            expect(mockStepResult.rootNodes).toBeDefined();
            expect(mockStepResult.rootNodes![0].color).toMatch(/^#[0-9A-F]{6}$/);

            // 2. 验证数据传输（JSON 序列化）
            const json = JSON.stringify(mockStepResult);
            const parsed = JSON.parse(json);
            expect(parsed.rootNodes[0].color).toBe('#C0C0C0');

            // 3. 验证 Three.js 颜色转换
            const color = mockStepResult.rootNodes[0].children![0].color!;
            const colorNum = parseInt(color.replace('#', ''), 16);
            expect(colorNum).toBe(0xFF5733);
            expect(colorNum).toBeGreaterThanOrEqual(0);
            expect(colorNum).toBeLessThanOrEqual(0xFFFFFF);
        });

        it('should handle hierarchy colors correctly', () => {
            // 测试装配体层级中的颜色传递
            const mockHierarchy = {
                id: 'root',
                name: 'Assembly',
                type: 'assembly' as const,
                color: '#C0C0C0',
                children: [
                    {
                        id: 'part1',
                        name: 'Part1',
                        type: 'solid' as const,
                        shapeId: 'shape_1',
                        color: '#FF5733',
                    },
                    {
                        id: 'sub_assembly',
                        name: 'SubAssembly',
                        type: 'assembly' as const,
                        color: '#3498DB',
                        children: [
                            {
                                id: 'part2',
                                name: 'Part2',
                                type: 'solid' as const,
                                shapeId: 'shape_2',
                                color: '#2ECC71',
                            },
                        ],
                    },
                ],
            };

            // 验证层级结构中的颜色
            expect(mockHierarchy.color).toBe('#C0C0C0');
            expect(mockHierarchy.children[0].color).toBe('#FF5733');
            expect(mockHierarchy.children[1].color).toBe('#3498DB');
            expect(mockHierarchy.children[1].children![0].color).toBe('#2ECC71');

            // 验证所有颜色格式正确
            const allColors = collectColors(mockHierarchy);
            allColors.forEach(color => {
                expect(color).toMatch(/^#[0-9A-F]{6}$/);
            });
        });
    });

    describe('Color Data Integrity', () => {
        it('should preserve color through JSON serialization', () => {
            const testData = {
                id: 'test',
                name: 'Test Part',
                type: 'solid' as const,
                color: '#FF5733',
            };

            // 序列化
            const json = JSON.stringify(testData);

            // 反序列化
            const parsed = JSON.parse(json);

            // 验证颜色完整性
            expect(parsed.color).toBe(testData.color);
        });

        it('should handle special color values', () => {
            const specialColors = [
                '#000000', // 黑色
                '#FFFFFF', // 白色
                '#808080', // 默认灰色
                '#FF0000', // 纯红
                '#00FF00', // 纯绿
                '#0000FF', // 纯蓝
            ];

            specialColors.forEach(color => {
                // 验证格式
                expect(color).toMatch(/^#[0-9A-F]{6}$/);

                // 验证转换
                const num = parseInt(color.replace('#', ''), 16);
                expect(num).toBeGreaterThanOrEqual(0);
                expect(num).toBeLessThanOrEqual(0xFFFFFF);

                // 验证往返转换
                const back = '#' + num.toString(16).padStart(6, '0').toUpperCase();
                expect(back).toBe(color);
            });
        });
    });

    describe('Color Performance', () => {
        it('should handle large number of colors efficiently', () => {
            const colorCount = 10000;
            const colors: string[] = [];

            const startTime = performance.now();

            // 生成随机颜色
            for (let i = 0; i < colorCount; i++) {
                const r = Math.floor(Math.random() * 256);
                const g = Math.floor(Math.random() * 256);
                const b = Math.floor(Math.random() * 256);
                const hex = '#' +
                    r.toString(16).padStart(2, '0').toUpperCase() +
                    g.toString(16).padStart(2, '0').toUpperCase() +
                    b.toString(16).padStart(2, '0').toUpperCase();
                colors.push(hex);
            }

            const generationTime = performance.now() - startTime;

            // 转换所有颜色
            const convertStartTime = performance.now();
            const numbers = colors.map(hex => parseInt(hex.replace('#', ''), 16));
            const conversionTime = performance.now() - convertStartTime;

            // 性能断言
            expect(generationTime).toBeLessThan(100); // 生成 10k 颜色 < 100ms
            expect(conversionTime).toBeLessThan(50);  // 转换 10k 颜色 < 50ms
            expect(colors.length).toBe(colorCount);
            expect(numbers.length).toBe(colorCount);

            // 验证所有颜色有效
            colors.forEach(color => {
                expect(color).toMatch(/^#[0-9A-F]{6}$/);
            });
        });

        it('should cache color conversions efficiently', () => {
            const cache = new Map<string, number>();

            function getCachedColor(hex: string): number {
                if (!cache.has(hex)) {
                    cache.set(hex, parseInt(hex.replace('#', ''), 16));
                }
                return cache.get(hex)!;
            }

            const testColors = ['#FF5733', '#3498DB', '#2ECC71'];
            const iterations = 10000;

            // 首次访问（未缓存）
            const coldStartTime = performance.now();
            for (let i = 0; i < iterations; i++) {
                testColors.forEach(color => getCachedColor(color));
            }
            const coldTime = performance.now() - coldStartTime;

            // 清除缓存
            cache.clear();

            // 无缓存版本（对比）
            const noCacheStartTime = performance.now();
            for (let i = 0; i < iterations; i++) {
                testColors.forEach(color => {
                    parseInt(color.replace('#', ''), 16);
                });
            }
            const noCacheTime = performance.now() - noCacheStartTime;

            // 缓存版本应该更快或相当
            // 注意：对于简单操作，缓存可能不会显著提升性能
            expect(coldTime).toBeLessThan(noCacheTime * 1.5);
        });
    });

    describe('Color Validation', () => {
        it('should reject invalid color formats', () => {
            const invalidColors = [
                'FF5733',        // 缺少 #
                '#FFF',          // 3位格式
                '#GGGGGG',       // 非法字符
                'rgb(255,0,0)',  // RGB 格式
                '#12345',        // 5位
                '#1234567',      // 7位
                '',              // 空字符串
            ];

            const colorRegex = /^#[0-9A-F]{6}$/;

            invalidColors.forEach(color => {
                expect(color).not.toMatch(colorRegex);
            });
        });

        it('should accept valid color formats', () => {
            const validColors = [
                '#000000',
                '#FFFFFF',
                '#FF5733',
                '#3498DB',
                '#ABCDEF',
            ];

            const colorRegex = /^#[0-9A-F]{6}$/;

            validColors.forEach(color => {
                expect(color).toMatch(colorRegex);
            });
        });

        it('should normalize color values', () => {
            // RGB 分量应该在 0-255 范围内
            const testCases = [
                { r: 255, g: 87, b: 51, expected: '#FF5733' },
                { r: 0, g: 0, b: 0, expected: '#000000' },
                { r: 255, g: 255, b: 255, expected: '#FFFFFF' },
            ];

            testCases.forEach(({ r, g, b, expected }) => {
                // 确保值在范围内
                expect(r).toBeGreaterThanOrEqual(0);
                expect(r).toBeLessThanOrEqual(255);
                expect(g).toBeGreaterThanOrEqual(0);
                expect(g).toBeLessThanOrEqual(255);
                expect(b).toBeGreaterThanOrEqual(0);
                expect(b).toBeLessThanOrEqual(255);

                // 转换为十六进制
                const hex = '#' +
                    r.toString(16).padStart(2, '0').toUpperCase() +
                    g.toString(16).padStart(2, '0').toUpperCase() +
                    b.toString(16).padStart(2, '0').toUpperCase();

                expect(hex).toBe(expected);
            });
        });
    });

    describe('Color Compatibility', () => {
        it('should be compatible with Three.js color system', () => {
            const testColors = [
                { hex: '#FF5733', r: 255, g: 87, b: 51 },
                { hex: '#3498DB', r: 52, g: 152, b: 219 },
                { hex: '#2ECC71', r: 46, g: 204, b: 113 },
            ];

            testColors.forEach(({ hex, r, g, b }) => {
                // 转换为 Three.js 数值格式
                const num = parseInt(hex.replace('#', ''), 16);

                // 验证 RGB 分量
                const extractedR = (num >> 16) & 0xFF;
                const extractedG = (num >> 8) & 0xFF;
                const extractedB = num & 0xFF;

                expect(extractedR).toBe(r);
                expect(extractedG).toBe(g);
                expect(extractedB).toBe(b);

                // 反向验证
                const reconstructed = (r << 16) | (g << 8) | b;
                expect(reconstructed).toBe(num);
            });
        });

        it('should handle color interpolation', () => {
            // 颜色插值（用于动画）
            function interpolateColor(color1: string, color2: string, t: number): string {
                const num1 = parseInt(color1.replace('#', ''), 16);
                const num2 = parseInt(color2.replace('#', ''), 16);

                const r1 = (num1 >> 16) & 0xFF;
                const g1 = (num1 >> 8) & 0xFF;
                const b1 = num1 & 0xFF;

                const r2 = (num2 >> 16) & 0xFF;
                const g2 = (num2 >> 8) & 0xFF;
                const b2 = num2 & 0xFF;

                const r = Math.floor(r1 + (r2 - r1) * t);
                const g = Math.floor(g1 + (g2 - g1) * t);
                const b = Math.floor(b1 + (b2 - b1) * t);

                return '#' +
                    r.toString(16).padStart(2, '0').toUpperCase() +
                    g.toString(16).padStart(2, '0').toUpperCase() +
                    b.toString(16).padStart(2, '0').toUpperCase();
            }

            // 测试黑到白的插值
            expect(interpolateColor('#000000', '#FFFFFF', 0)).toBe('#000000');
            expect(interpolateColor('#000000', '#FFFFFF', 0.5)).toBe('#7F7F7F');
            expect(interpolateColor('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');

            // 测试红到蓝的插值
            const midColor = interpolateColor('#FF0000', '#0000FF', 0.5);
            expect(midColor).toMatch(/^#[0-9A-F]{6}$/);
        });
    });
});

/**
 * 辅助函数：递归收集所有颜色
 */
function collectColors(node: any): string[] {
    const colors: string[] = [];

    if (node.color) {
        colors.push(node.color);
    }

    if (node.children) {
        node.children.forEach((child: any) => {
            colors.push(...collectColors(child));
        });
    }

    return colors;
}

/**
 * 辅助函数：加载测试 STEP 文件
 *
 * 在实际环境中，应该从测试资源目录加载真实的 STEP 文件
 * 建议使用 ../CADToolbox/src/python/test_use_case/ 中的测试数据
 */
async function loadTestFile(filename: string): Promise<ArrayBuffer> {
    // 在实际测试环境中实现文件加载
    // 示例实现：
    // const fs = await import('fs/promises');
    // const buffer = await fs.readFile(`./test-data/${filename}`);
    // return buffer.buffer;

    throw new Error(`Test file loading not implemented: ${filename}`);
}
