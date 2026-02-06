# 零件颜色功能使用示例

**生成日期**: 2026-02-06
**适用版本**: v1.0.0+

---

## 目录

1. [基础使用](#基础使用)
2. [STEP 文件准备](#step-文件准备)
3. [编程接口](#编程接口)
4. [高级用法](#高级用法)
5. [常见场景](#常见场景)
6. [故障排查](#故障排查)

---

## 基础使用

### 1. 导入带颜色的 STEP 文件

```typescript
// 在 VSCode 中使用命令
// Ctrl+Shift+P -> "CAD Tool: Import STEP File"

// 或者通过代码
import * as vscode from 'vscode';

async function importColoredStep() {
    const uri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'STEP Files': ['step', 'stp'] }
    });

    if (uri && uri[0]) {
        // 读取文件
        const fileData = await vscode.workspace.fs.readFile(uri[0]);

        // 发送到 WebView 进行处理
        // 颜色信息会自动从 STEP 文件中提取
        panel.webview.postMessage({
            command: 'loadStepFile',
            fileName: uri[0].fsPath,
            fileContent: Buffer.from(fileData).toString('base64')
        });
    }
}
```

### 2. 查看零件颜色

导入文件后，颜色会自动应用：

```typescript
// WebView 端 (main.ts)
async function loadStepFile(fileName: string, base64Content: string) {
    // 解析 STEP 文件
    const result = await occt.readStep(arrayBuffer, baseId);

    // result.rootNodes 包含颜色信息
    console.log('Color:', result.rootNodes[0].color); // 例如: "#FF5733"

    // 颜色会自动应用到 3D 模型
}
```

### 3. 在属性面板查看颜色

选中零件后，属性面板会显示颜色信息：

```
┌─────────────────────────┐
│ Properties              │
├─────────────────────────┤
│ ID: part_1              │
│ Name: Cover             │
│ Type: solid             │
│ Color: ■ #FF5733        │
│        [Change] 按钮     │
└─────────────────────────┘
```

---

## STEP 文件准备

### 如何确保 STEP 文件包含颜色

#### 使用 SolidWorks

1. 在零件中应用颜色（外观/材质）
2. 文件 → 另存为 → STEP (*.step, *.stp)
3. 选项 → 勾选 "Export colors"
4. 保存

#### 使用 Fusion 360

1. 修改 → 外观 → 应用颜色
2. 文件 → 导出 → STEP
3. 在导出选项中确保选择 "STEP 242" 格式
4. 导出

#### 使用 FreeCAD

1. 在零件上设置颜色：View → Appearance → Shape Color
2. File → Export → STEP with colors (AP214)
3. 确保选择 AP214 或 AP242 协议

#### 验证 STEP 文件包含颜色

使用文本编辑器打开 STEP 文件，搜索 `COLOUR_RGB` 或 `STYLED_ITEM`：

```step
#123 = COLOUR_RGB('',0.8,0.2,0.1);
#124 = STYLED_ITEM('',(#123),#125);
```

如果找到这些行，说明文件包含颜色信息。

---

## 编程接口

### TypeScript API

#### 1. 读取 STEP 文件并获取颜色

```typescript
import { OcctWrapper } from '@cadtool-online/geo';

async function loadWithColors() {
    const occt = new OcctWrapper();
    await occt.initialize();

    // 读取 STEP 文件
    const fileData = await fetch('model.step').then(r => r.arrayBuffer());
    const result = await occt.readStep(fileData, 'myModel');

    if (result.success && result.rootNodes) {
        // 遍历所有节点
        result.rootNodes.forEach(node => {
            console.log(`${node.name}: ${node.color}`);

            // 递归处理子节点
            if (node.children) {
                processChildren(node.children);
            }
        });
    }
}

function processChildren(children: StepNode[]) {
    children.forEach(child => {
        console.log(`  ${child.name}: ${child.color}`);
        if (child.children) {
            processChildren(child.children);
        }
    });
}
```

#### 2. 设置零件颜色

```typescript
import { ThreeViewer } from '@cadtool-online/three';

const viewer = new ThreeViewer(container);

// 方法 1: 使用十六进制数值
viewer.setMeshColor('mesh_part1', 0xFF5733);

// 方法 2: 从字符串转换
const hexColor = '#FF5733';
viewer.setMeshColor('mesh_part1', parseInt(hexColor.replace('#', ''), 16));

// 方法 3: 从 RGB 值
function setColorFromRGB(meshId: string, r: number, g: number, b: number) {
    const hex = (r << 16) | (g << 8) | b;
    viewer.setMeshColor(meshId, hex);
}
setColorFromRGB('mesh_part1', 255, 87, 51);
```

#### 3. 批量设置颜色

```typescript
// 为多个零件设置相同颜色
function setGroupColor(meshIds: string[], color: number) {
    meshIds.forEach(id => {
        viewer.setMeshColor(id, color);
    });
}

setGroupColor(['mesh_1', 'mesh_2', 'mesh_3'], 0x3498DB);

// 根据类型设置颜色
function colorByType(shapes: LoadedShape[]) {
    const colors = {
        assembly: 0xC0C0C0,  // 银色
        part: 0x3498DB,      // 蓝色
        solid: 0xFF5733      // 橙红色
    };

    shapes.forEach(shape => {
        if (shape.meshId) {
            viewer.setMeshColor(shape.meshId, colors[shape.type]);
        }
    });
}
```

#### 4. 颜色转换工具函数

```typescript
// 十六进制字符串 → 数值
function hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

// 数值 → 十六进制字符串
function numberToHex(num: number): string {
    return '#' + num.toString(16).padStart(6, '0').toUpperCase();
}

// RGB → 十六进制
function rgbToHex(r: number, g: number, b: number): string {
    return '#' +
        r.toString(16).padStart(2, '0').toUpperCase() +
        g.toString(16).padStart(2, '0').toUpperCase() +
        b.toString(16).padStart(2, '0').toUpperCase();
}

// 十六进制 → RGB
function hexToRgb(hex: string): { r: number, g: number, b: number } {
    const num = parseInt(hex.replace('#', ''), 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

// 使用示例
console.log(hexToNumber('#FF5733'));      // 16733491
console.log(numberToHex(16733491));       // #FF5733
console.log(rgbToHex(255, 87, 51));       // #FF5733
console.log(hexToRgb('#FF5733'));         // { r: 255, g: 87, b: 51 }
```

---

## 高级用法

### 1. 颜色主题切换

```typescript
// 定义颜色主题
const themes = {
    default: {
        assembly: '#C0C0C0',
        part: '#808080',
        solid: '#606060'
    },
    vibrant: {
        assembly: '#E74C3C',
        part: '#3498DB',
        solid: '#2ECC71'
    },
    monochrome: {
        assembly: '#FFFFFF',
        part: '#CCCCCC',
        solid: '#999999'
    }
};

function applyTheme(themeName: keyof typeof themes) {
    const theme = themes[themeName];

    loadedShapes.forEach((shape, id) => {
        if (shape.meshId) {
            const color = theme[shape.type];
            viewer.setMeshColor(shape.meshId, hexToNumber(color));
            shape.color = color;
        }
    });

    updateModelTree();
}

// 使用
applyTheme('vibrant');
```

### 2. 根据属性着色

```typescript
// 根据体积大小着色
async function colorByVolume() {
    const volumes = new Map<string, number>();

    // 计算所有零件的体积
    for (const [id, shape] of loadedShapes) {
        if (shape.shapeId && occt.hasShape(shape.shapeId)) {
            const massProps = occt.getMassProperties(shape.shapeId);
            if (massProps) {
                volumes.set(id, massProps.volume);
            }
        }
    }

    // 找出最大和最小体积
    const volArray = Array.from(volumes.values());
    const minVol = Math.min(...volArray);
    const maxVol = Math.max(...volArray);

    // 应用颜色渐变（蓝色 → 红色）
    volumes.forEach((volume, id) => {
        const shape = loadedShapes.get(id);
        if (shape?.meshId) {
            // 归一化到 0-1
            const normalized = (volume - minVol) / (maxVol - minVol);

            // 蓝 → 红渐变
            const r = Math.floor(normalized * 255);
            const b = Math.floor((1 - normalized) * 255);
            const color = (r << 16) | b;

            viewer.setMeshColor(shape.meshId, color);
            shape.color = numberToHex(color);
        }
    });
}
```

### 3. 颜色动画

```typescript
// 高亮动画
function highlightPart(meshId: string, duration: number = 1000) {
    const shape = Array.from(loadedShapes.values()).find(s => s.meshId === meshId);
    if (!shape) return;

    const originalColor = shape.color || '#808080';
    const highlightColor = '#FFFF00'; // 黄色

    let startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = (elapsed % duration) / duration;

        // 使用正弦函数创建平滑的闪烁效果
        const factor = (Math.sin(progress * Math.PI * 2) + 1) / 2;

        // 在原始颜色和高亮色之间插值
        const origRgb = hexToRgb(originalColor);
        const highRgb = hexToRgb(highlightColor);

        const r = Math.floor(origRgb.r + (highRgb.r - origRgb.r) * factor);
        const g = Math.floor(origRgb.g + (highRgb.g - origRgb.g) * factor);
        const b = Math.floor(origRgb.b + (highRgb.b - origRgb.b) * factor);

        const color = (r << 16) | (g << 8) | b;
        viewer.setMeshColor(meshId, color);

        if (elapsed < duration) {
            requestAnimationFrame(animate);
        } else {
            // 恢复原始颜色
            viewer.setMeshColor(meshId, hexToNumber(originalColor));
        }
    }

    animate();
}

// 使用
highlightPart('mesh_part1', 2000); // 闪烁 2 秒
```

### 4. 颜色持久化

```typescript
// 保存颜色配置
function saveColorConfiguration(): string {
    const config: Record<string, string> = {};

    loadedShapes.forEach((shape, id) => {
        if (shape.color) {
            config[id] = shape.color;
        }
    });

    return JSON.stringify(config, null, 2);
}

// 加载颜色配置
function loadColorConfiguration(jsonConfig: string) {
    const config = JSON.parse(jsonConfig);

    Object.entries(config).forEach(([id, color]) => {
        const shape = loadedShapes.get(id);
        if (shape?.meshId) {
            viewer.setMeshColor(shape.meshId, hexToNumber(color as string));
            shape.color = color as string;
        }
    });
}

// 使用示例
// 保存
const config = saveColorConfiguration();
localStorage.setItem('cadtool-colors', config);

// 加载
const savedConfig = localStorage.getItem('cadtool-colors');
if (savedConfig) {
    loadColorConfiguration(savedConfig);
}
```

---

## 常见场景

### 场景 1: 区分不同材质

```typescript
const materialColors = {
    steel: 0xC0C0C0,      // 银灰色
    aluminum: 0xD3D3D3,   // 浅灰色
    plastic: 0x3498DB,    // 蓝色
    rubber: 0x2C3E50,     // 深灰色
    copper: 0xB87333,     // 古铜色
};

function setMaterialColor(meshId: string, material: keyof typeof materialColors) {
    viewer.setMeshColor(meshId, materialColors[material]);
}

// 使用
setMaterialColor('mesh_body', 'steel');
setMaterialColor('mesh_seal', 'rubber');
```

### 场景 2: 装配体层级着色

```typescript
// 根据层级深度应用不同深浅的颜色
function colorByHierarchyDepth(node: LoadedShape, depth: number = 0, baseColor: number = 0x3498DB) {
    if (node.meshId) {
        // 每深一层，颜色变暗 10%
        const factor = Math.pow(0.9, depth);
        const r = ((baseColor >> 16) & 255) * factor;
        const g = ((baseColor >> 8) & 255) * factor;
        const b = (baseColor & 255) * factor;

        const color = (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
        viewer.setMeshColor(node.meshId, color);
    }

    if (node.children) {
        node.children.forEach(child => colorByHierarchyDepth(child, depth + 1, baseColor));
    }
}

// 使用
rootShapes.forEach(shape => colorByHierarchyDepth(shape));
```

### 场景 3: 热力图可视化

```typescript
// 根据应力、温度等数值显示热力图
function applyHeatMap(values: Map<string, number>) {
    const vals = Array.from(values.values());
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    values.forEach((value, meshId) => {
        const normalized = (value - min) / (max - min);

        // 热力图颜色：蓝 → 绿 → 黄 → 红
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

        const color = (r << 16) | (g << 8) | b;
        viewer.setMeshColor(meshId, color);
    });
}

// 使用示例：根据质量显示热力图
const masses = new Map<string, number>();
loadedShapes.forEach((shape, id) => {
    if (shape.shapeId && occt.hasShape(shape.shapeId)) {
        const props = occt.getMassProperties(shape.shapeId);
        if (props && shape.meshId) {
            masses.set(shape.meshId, props.mass);
        }
    }
});
applyHeatMap(masses);
```

---

## 故障排查

### 问题 1: 导入后所有零件都是灰色

**可能原因**:
- STEP 文件不包含颜色信息
- STEP 文件格式不支持颜色（需要 AP214 或 AP242）

**解决方案**:
```typescript
// 检查是否有颜色信息
const result = await occt.readStep(fileData);
console.log('Root nodes:', result.rootNodes);

if (result.rootNodes) {
    result.rootNodes.forEach(node => {
        console.log(`${node.name}: ${node.color || 'NO COLOR'}`);
    });
}

// 如果没有颜色，手动应用
if (!result.rootNodes[0].color || result.rootNodes[0].color === '#808080') {
    console.warn('No color info in STEP file, applying manual colors');
    applyTheme('vibrant');
}
```

### 问题 2: 颜色更改后不生效

**可能原因**:
- Mesh ID 不正确
- Material 类型不是 MeshPhongMaterial

**解决方案**:
```typescript
function debugColorChange(meshId: string, color: number) {
    const mesh = viewer.getMesh(meshId);

    if (!mesh) {
        console.error(`Mesh not found: ${meshId}`);
        return false;
    }

    console.log('Mesh material type:', mesh.material.constructor.name);

    if (!(mesh.material instanceof THREE.MeshPhongMaterial)) {
        console.error('Material is not MeshPhongMaterial');

        // 替换材质
        const newMaterial = new THREE.MeshPhongMaterial({
            color: color,
            side: THREE.DoubleSide
        });
        mesh.material.dispose();
        mesh.material = newMaterial;

        return true;
    }

    viewer.setMeshColor(meshId, color);
    return true;
}
```

### 问题 3: 颜色显示不准确

**可能原因**:
- 颜色空间问题（sRGB vs Linear）
- 光照影响

**解决方案**:
```typescript
// 1. 检查渲染器设置
const renderer = viewer.getRenderer();
console.log('Output color space:', renderer.outputColorSpace);

// 2. 调整光照
const scene = viewer.getScene();
scene.children.forEach(child => {
    if (child instanceof THREE.Light) {
        console.log(`Light: ${child.type}, Intensity: ${child.intensity}`);
    }
});

// 3. 测试纯色
viewer.setMeshColor('test_mesh', 0xFF0000); // 纯红
viewer.setMeshColor('test_mesh', 0x00FF00); // 纯绿
viewer.setMeshColor('test_mesh', 0x0000FF); // 纯蓝
```

---

## 最佳实践

1. **始终验证颜色格式**
   ```typescript
   function isValidColor(color: string): boolean {
       return /^#[0-9A-F]{6}$/.test(color);
   }
   ```

2. **提供默认颜色**
   ```typescript
   const color = shape.color && isValidColor(shape.color) ? shape.color : '#808080';
   ```

3. **缓存颜色转换结果**
   ```typescript
   const colorCache = new Map<string, number>();

   function getCachedColor(hex: string): number {
       if (!colorCache.has(hex)) {
           colorCache.set(hex, parseInt(hex.replace('#', ''), 16));
       }
       return colorCache.get(hex)!;
   }
   ```

4. **批量操作时使用 RAF**
   ```typescript
   function batchColorUpdate(updates: Array<{id: string, color: number}>) {
       requestAnimationFrame(() => {
           updates.forEach(({id, color}) => {
               viewer.setMeshColor(id, color);
           });
       });
   }
   ```

---

## 参考链接

- [API 设计文档](../design/api-design.md)
- [颜色功能验证](../design/color-feature-validation.md)
- [测试用例](../../packages/geo/src/__tests__/color-parsing.spec.ts)
- [Three.js Color 文档](https://threejs.org/docs/#api/en/math/Color)
