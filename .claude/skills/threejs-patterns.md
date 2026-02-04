# Three.js 渲染技能

## 从 WASM 数据创建 Mesh
```typescript
function createMeshFromWasm(meshData: MeshData): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
        new THREE.BufferAttribute(meshData.vertices, 3));
    geometry.setAttribute('normal',
        new THREE.BufferAttribute(meshData.normals, 3));
    geometry.setIndex(
        new THREE.BufferAttribute(meshData.indices, 1));

    return new THREE.Mesh(geometry, material);
}
```

## 标架可视化
```typescript
const frame = new THREE.AxesHelper(10);
frame.position.set(x, y, z);
frame.setRotationFromMatrix(rotationMatrix);
```

## 关节可视化
- Revolute: 圆环 + 旋转轴
- Prismatic: 箭头 + 滑动方向
- Spherical: 球体

## 性能优化
- 使用 `BufferGeometry` 而非 `Geometry`
- 合并静态几何体
- 使用 LOD 处理大模型
- 避免每帧创建新对象
