# 标架(Marker)创建功能实现总结

## 实现概述

本次实现了在零件上添加标架(marker)的完整功能，方向沿零件面法向向外。实现了从C++底层到TypeScript前端的完整工作流。

## 功能特性

- **面法向计算**：使用OCCT射线相交算法获取点击位置的面法向
- **标架自动生成**：根据法向自动计算标架的X、Y、Z轴方向（右手系）
- **3D可视化**：在Three.js场景中显示标架坐标系（X红、Y绿、Z蓝）
- **交互式创建**：点击零件表面即可创建标架
- **删除功能**：支持删除最后创建的标架

## 实现架构

### 1. C++ WASM 层 (packages/geo/cpp/src/geo/geo_binding.cpp)

#### 新增头文件
```cpp
// T2.5: Face normal calculation for marker creation
#include <BRepIntCurveSurface_Inter.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <GeomLProp_SLProps.hxx>
#include <IntCurveSurface_IntersectionPoint.hxx>
#include <gp_Lin.hxx>
```

#### 核心函数：`getFaceNormalAtPoint`
```cpp
std::string getFaceNormalAtPoint(
    const std::string& id,
    double rayOriginX, double rayOriginY, double rayOriginZ,
    double rayDirX, double rayDirY, double rayDirZ
)
```

**功能**：
- 使用射线相交算法找到最近的面交点
- 计算交点处的面法向
- 自动处理反向面（TopAbs_REVERSED）
- 返回JSON格式：`{success, position, normal, distance}`

**算法流程**：
1. 创建射线：`gp_Lin(rayOrigin, rayDir)`
2. 执行相交测试：`BRepIntCurveSurface_Inter`
3. 找到最近交点
4. 使用`GeomLProp_SLProps`计算法向
5. 处理面方向（确保法向向外）

#### Embind 绑定
```cpp
// T2.5: Face normal calculation
function("getFaceNormalAtPoint", &getFaceNormalAtPoint);
```

---

### 2. TypeScript 几何层 (packages/geo/src/)

#### OcctWrapper 扩展

**新增接口定义** (types.ts):
```typescript
export interface FaceNormalResult {
    success: boolean;
    position: Vec3;
    normal: Vec3;
    distance: number;
    error?: string;
}
```

**新增方法** (OcctWrapper.ts):
```typescript
getFaceNormalAtPoint(
    shapeId: string,
    rayOrigin: { x: number; y: number; z: number },
    rayDir: { x: number; y: number; z: number }
): FaceNormalResult | null
```

---

### 3. 核心业务层 (packages/core/src/services/)

#### MarkerCreator 服务类

**文件位置**：`packages/core/src/services/MarkerCreator.ts`

**核心功能**：
```typescript
export class MarkerCreator {
    // 从法向量创建标架方向矩阵
    private createOrientationFromNormal(normal: Vec3): Mat3

    // 创建标架
    createMarker(params: MarkerCreationParams): MbsMarker
}
```

**方向矩阵算法**：
1. **Z轴**：归一化法向量
2. **临时X轴**：根据Z轴方向选择
   - 如果Z接近竖直：使用`(1,0,0)`
   - 否则使用`(0,0,1)`
3. **Y轴**：`Y = Z × tempX`（叉积）
4. **X轴**：`X = Y × Z`（确保右手系）

**返回值**：列主序3×3矩阵 `[X Y Z]`

---

### 4. 3D 可视化层 (packages/three/src/)

#### ThreeViewer 扩展

**新增方法**：
```typescript
getRayFromScreenPoint(x: number, y: number): {
    origin: { x, y, z },
    direction: { x, y, z }
} | null
```

**功能**：
- 将屏幕坐标转换为3D射线
- 使用Three.js的Raycaster
- 返回射线原点和方向（归一化）

---

### 5. UI 交互层 (packages/vscode/src/webview/)

#### main.ts 实现

**状态管理**：
```typescript
let isCreatingMarker = false;
const createdMarkers: MbsMarker[] = [];
```

**核心流程**：

1. **启动标架创建模式** (`startMarkerCreation`)：
   - 检查是否选中零件
   - 设置光标为十字线
   - 显示提示信息

2. **处理画布点击** (`handleCanvasClick`)：
   - 获取点击位置的射线
   - 调用OCCT计算面法向
   - 使用MarkerCreator创建标架
   - 在3D场景中可视化
   - 退出创建模式

3. **删除标架** (`deleteFrame` action)：
   - 从数组中移除最后一个
   - 从3D场景中删除可视化

---

## 文件清单

### 新增文件
1. `packages/core/src/services/MarkerCreator.ts` - 标架创建服务

### 修改文件
1. `packages/geo/cpp/src/geo/geo_binding.cpp` - C++ WASM绑定
2. `packages/geo/src/OcctWrapper.ts` - TypeScript WASM包装器
3. `packages/geo/src/types.ts` - 类型定义
4. `packages/core/src/index.ts` - 导出MarkerCreator
5. `packages/three/src/ThreeViewer.ts` - 添加射线获取方法
6. `packages/vscode/src/webview/main.ts` - UI交互逻辑

---

## 编译和测试

### 1. 编译 WASM 模块

```bash
# 在项目根目录执行
cd packages/geo/cpp

# 激活 Emscripten 环境 (Windows)
build\emsdk\emsdk_env.bat

# 或 (Linux/Mac)
source build/emsdk/emsdk_env.sh

# 编译 Release 版本
bash build_wasm.sh release

# 或编译 Debug 版本（用于调试）
bash build_wasm.sh debug
```

**输出文件**：
- `packages/geo/wasm/cad-geo.js`
- `packages/geo/wasm/cad-geo.wasm`
- `packages/geo/wasm/cad-geo.d.ts`

### 2. 构建 TypeScript

```bash
# 在项目根目录执行
pnpm build
```

### 3. 启动 VSCode 插件

```bash
# 方法1：VSCode调试
# 按 F5 启动调试

# 方法2：命令行
pnpm dev
```

---

## 使用指南

### 基本使用流程

1. **打开CAD模型**
   - 点击"Import STEP"按钮
   - 选择STEP文件导入

2. **选择零件**
   - 在模型树中点击要添加标架的零件
   - 或在3D视图中点击零件

3. **创建标架**
   - 点击Ribbon菜单 → "标架设计" → "新建标架"
   - 状态栏显示："Click on a face to create marker (法向向外)"
   - 鼠标光标变为十字线
   - 在零件表面点击

4. **查看结果**
   - 3D视图中显示坐标系：
     - **X轴**：红色箭头
     - **Y轴**：绿色箭头
     - **Z轴**：蓝色箭头（沿面法向向外）
     - **原点**：黄色球体

5. **删除标架**
   - 点击Ribbon菜单 → "标架设计" → "删除标架"
   - 删除最后创建的标架

---

## 技术细节

### 坐标系统

**右手坐标系，Z轴向上**（符合CLAUDE.md约定）

```
    Z↑
    |
    |___→ X
   /
  ↙Y
```

### 法向计算精度

- OCCT精度：`1e-6` (在geo_binding.cpp中配置)
- 适用范围：`1e-6` ~ `1e+6` (符合CLAUDE.md要求)

### 方向矩阵格式

**列主序（Column-Major）**：
```typescript
Mat3 {
  m: [
    X.x, X.y, X.z,  // Column 0: X-axis
    Y.x, Y.y, Y.z,  // Column 1: Y-axis
    Z.x, Z.y, Z.z   // Column 2: Z-axis
  ]
}
```

### FrameVisualizer 读取方式
```typescript
// 从 Mat3 提取轴向量（注意索引）
const m = orientation.m;
const xAxis = new THREE.Vector3(m[0], m[3], m[6]);
const yAxis = new THREE.Vector3(m[1], m[4], m[7]);
const zAxis = new THREE.Vector3(m[2], m[5], m[8]);
```

---

## 已知限制

1. **WASM编译依赖**：
   - 需要先运行`pnpm setup:wasm`安装Emscripten SDK
   - 需要OCCT库已编译

2. **交互限制**：
   - 一次只能选择一个零件
   - 必须点击在零件表面上（否则无法创建）
   - 删除功能仅删除最后一个标架（LIFO）

3. **性能考虑**：
   - 射线相交计算在WASM中执行，复杂模型可能稍慢
   - 建议模型面数 < 100,000

---

## 未来扩展方向

1. **标架编辑**：
   - 实现`editFrame`功能
   - 支持拖拽移动标架
   - 支持旋转调整方向

2. **标架列表**：
   - 在属性面板显示所有标架
   - 支持选择删除特定标架
   - 支持标架重命名

3. **标架约束**：
   - 标架吸附到特殊点（顶点、边中点、面中心）
   - 标架对齐到边或轴

4. **导出功能**：
   - 将标架信息导出到Modelica
   - 用于后续关节定义

---

## 参考代码位置

### CADToolbox 原版参考
根据CLAUDE.md，参考路径应该是：
- `../CADToolbox/cad_mbs_model/src/model/factory/` - 标架工厂
- `../CADToolbox/cad_mbs_model/src/model/body/` - 刚体和标架关联

### chili3d 参考
- WASM编译配置
- Embind绑定模式

---

## 测试建议

### 单元测试
创建文件：`packages/geo/src/__tests__/face-normal.spec.ts`
```typescript
describe('getFaceNormalAtPoint', () => {
  it('should calculate normal on box top face', async () => {
    // TODO: 实现测试
  });
});
```

### 集成测试
创建文件：`packages/core/src/__tests__/marker-creator.spec.ts`
```typescript
describe('MarkerCreator', () => {
  it('should create marker with correct orientation', () => {
    // TODO: 实现测试
  });
});
```

---

## 提交信息建议

```
feat(mbs): add marker creation on part faces

- Implement C++ face normal calculation using OCCT raycasting
- Add MarkerCreator service for automatic frame orientation
- Add 3D visualization with color-coded axes (X=red, Y=green, Z=blue)
- Support interactive marker creation via Ribbon menu
- Add delete marker functionality

Related: CADToolbox marker factory implementation
```

---

## 联系人

如有问题，请参考：
- 项目文档：`.claude/agents/project-context.md`
- 代码风格：`.claude/rules/coding-style.md`
- Git工作流：`.claude/rules/git-workflow.md`
