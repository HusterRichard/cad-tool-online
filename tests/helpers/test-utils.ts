// 测试辅助工具
// 提供常用的测试工具函数和 Mock 对象

/**
 * 等待指定时间
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建测试用的 MeshData
 */
export function createMockMeshData() {
  return {
    vertices: new Float32Array([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    normals: new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1
    ])
  };
}

/**
 * 创建测试用的 Transform
 */
export function createMockTransform() {
  return {
    position: [0, 0, 0] as [number, number, number],
    orientation: [0, 0, 0, 1] as [number, number, number, number]
  };
}

/**
 * Mock WASM 几何模块
 */
export function createMockGeoModule() {
  return {
    readStepFile: async (data: Uint8Array) => {
      return [
        {
          id: 'mock-shape-1',
          name: 'MockShape',
          mesh: createMockMeshData(),
          boundingBox: {
            min: [0, 0, 0],
            max: [1, 1, 1]
          },
          volume: 1.0
        }
      ];
    },
    tesselate: (shape: any) => {
      return createMockMeshData();
    },
    computeMassProperties: (shapes: any[], density: number) => {
      return {
        mass: 1.0,
        centerOfMass: [0.5, 0.5, 0.5],
        inertia: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1]
        ]
      };
    }
  };
}

/**
 * Mock VSCode API
 */
export function createMockVSCode() {
  const messageHandlers: Array<(message: any) => void> = [];

  return {
    window: {
      showOpenDialog: vi.fn(),
      showSaveDialog: vi.fn(),
      showInformationMessage: vi.fn(),
      showErrorMessage: vi.fn()
    },
    workspace: {
      fs: {
        readFile: vi.fn(),
        writeFile: vi.fn()
      }
    },
    webview: {
      postMessage: vi.fn(),
      onDidReceiveMessage: (handler: (message: any) => void) => {
        messageHandlers.push(handler);
        return { dispose: () => {} };
      },
      _triggerMessage: (message: any) => {
        messageHandlers.forEach(h => h(message));
      }
    }
  };
}

/**
 * 比较浮点数数组（允许误差）
 */
export function expectArrayClose(
  actual: number[],
  expected: number[],
  tolerance: number = 1e-6
) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((val, i) => {
    expect(Math.abs(val - expected[i])).toBeLessThan(tolerance);
  });
}
