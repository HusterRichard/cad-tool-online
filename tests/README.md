# 测试目录说明

本仓库采用混合测试布局：

- 包内单元测试靠近代码，便于跟随模块演化。
- 跨包、集成、E2E、fixture-heavy 测试统一放在根 `tests/`，便于共享数据、helper 和独立运行入口。

## 当前结构

```text
packages/
  core/
    test/                     # core 包内单元测试
  geo/
    src/__tests__/            # geo 包内单元测试
  three/
    test/                     # three 包内单元测试

tests/
  unit/
    extension/                # root src/extension.ts、panel 等跨包单测
    webview/                  # root src/webview/* 单测
  integration/
    step-import/              # STEP + WASM + 真实模型集成测试
  fixtures/
    step-files/               # 预留的精简 fixture 目录
  helpers/
    stepFixtures.ts           # STEP/WASM 集成测试共享 helper
    test-utils.ts             # 通用测试辅助函数
  vitest.config.ts            # 根 tests 运行配置
```

## 放置规则

### 保留在包内的测试

满足以下条件时，测试应放在包目录内：

- 只验证单个包的公开行为或内部纯逻辑。
- 不依赖根 `src/`、VS Code 扩展入口、Webview、WASM 运行时或大型 fixture。
- 与模块源码强绑定，适合和实现一起维护。

当前示例：

- `packages/core/test/*.spec.ts`
- `packages/geo/src/__tests__/*.spec.ts`
- `packages/three/test/*.spec.ts`

### 放到根 `tests/` 的测试

满足以下任一条件时，测试应放到根 `tests/`：

- 同时覆盖多个包或覆盖根 `src/` 代码。
- 需要真实 STEP 文件、WASM、较大的 fixture 或共享 helper。
- 属于扩展层、Webview 层、集成流程、回归测试或未来的 E2E 测试。

当前示例：

- `tests/unit/extension/extension.spec.ts`
- `tests/unit/extension/cad-editor-panel.spec.ts`
- `tests/unit/webview/*.spec.ts`
- `tests/integration/step-import/*.spec.ts`

## 运行方式

### 运行包内测试

```bash
pnpm --filter @cadtool-online/core test:run
pnpm --filter @cadtool-online/geo test:run
pnpm --filter @cadtool-online/three test:run
```

### 运行根 tests

```bash
pnpm test:root
pnpm test:root:run
pnpm test:root:coverage
```

### 运行全量自动化测试

```bash
pnpm test
```

`pnpm test` 当前会顺序执行：

1. `@cadtool-online/core` 包内测试
2. `@cadtool-online/geo` 包内测试
3. `@cadtool-online/three` 包内测试
4. 根 `tests/` 测试

## fixture 与模型来源

根集成测试优先复用仓库已有模型资源，而不是复制大文件到 `tests/fixtures/step-files/`。

当前 `tests/integration/step-import/` 主要通过 `tests/helpers/stepFixtures.ts` 读取：

- `packages/geo/wasm/cad-geo.wasm`
- `ref/model/*.STEP`

这样可以避免：

- `OcctWrapper.initialize()` 在纯 Node 测试环境下找不到默认 wasm 路径
- 大型 STEP 文件在仓库里重复存放

后续如果补充更小、更稳定的专用 fixture，可以放入 `tests/fixtures/step-files/`，并逐步替换对 `ref/model/` 的依赖。

## 命名约定

- 单元测试：`*.spec.ts`
- 集成测试：`*.test.ts` 或 `*.spec.ts`
- E2E 测试：`*.e2e.ts`

## 当前覆盖重点

### 包内单元测试

- Core 数据模型与连接规则
- Geo 纯工具函数
- Three 可视化器与交互管理器

### 根 tests

- VS Code 扩展命令注册与面板行为
- Webview 质量属性 worker / coordinator / render config
- STEP 层级与颜色回归

## 新增测试时的建议

1. 先判断测试是否只属于单个包。
2. 如果是，优先放在对应包内。
3. 如果测试依赖根 `src/`、真实 STEP、WASM 或跨包协作，放到根 `tests/`。
4. 新的 STEP/WASM 集成测试优先复用 `tests/helpers/stepFixtures.ts`。

## 已知事项

- 一些 STEP fixture 在 OCCT 解析时会输出 `Unresolved Reference` 日志，但当前读取结果仍为成功；相关集成测试按实际解析结果断言。
- 如果后续需要 VS Code 真宿主级测试，请在 `tests/e2e/` 下新增专用 runner，不要塞回包内单元测试目录。
