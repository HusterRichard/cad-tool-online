import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import type { MeshData } from '@cadtool-online/core';
import { SelectionManager, type SelectionCallback, type SelectionOptions } from './SelectionManager';
import { FrameVisualizer, type FrameData, type FrameVisualizerOptions } from './FrameVisualizer';
import { JointVisualizer, type JointData, type JointVisualizerOptions } from './JointVisualizer';

export type MaterialMode = 'matcap' | 'pbr' | 'flat' | 'phong';

export interface ThreeViewerOptions {
    backgroundColor?: number;
    antialias?: boolean;
    enableSelection?: boolean;
    selectionOptions?: SelectionOptions;
    frameOptions?: FrameVisualizerOptions;
    jointOptions?: JointVisualizerOptions;
    materialMode?: MaterialMode;
    enablePostProcessing?: boolean;
    enableOutline?: boolean;
    useEnvironmentMap?: boolean;
}

interface ViewerManagedMaterialState {
    managedByViewer: boolean;
    baseMaterial: THREE.Material;
}

export class ThreeViewer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private container: HTMLElement;
    private meshes: Map<string, THREE.Mesh> = new Map();
    private meshEdges: Map<string, THREE.LineSegments> = new Map();

    private materialMode: MaterialMode;
    private postProcessingEnabled: boolean;
    private outlineEnabled: boolean;
    private useEnvironmentMap: boolean;
    private edgeLayerVisible = true;

    private composer: EffectComposer | null = null;
    private outlinePass: OutlinePass | null = null;

    private pmremGenerator: THREE.PMREMGenerator | null = null;
    private environmentTexture: THREE.Texture | null = null;
    private matcapTexture: THREE.DataTexture;

    private readonly onResizeHandler: () => void;

    // MBS 可视化组件
    private selectionManager: SelectionManager | null = null;
    private frameVisualizer: FrameVisualizer;
    private jointVisualizer: JointVisualizer;

    constructor(container: HTMLElement, options: ThreeViewerOptions = {}) {
        this.container = container;
        this.materialMode = options.materialMode ?? 'phong';
        this.postProcessingEnabled = options.enablePostProcessing ?? true;
        this.outlineEnabled = options.enableOutline ?? (options.selectionOptions?.outlineEnabled ?? true);
        this.useEnvironmentMap = options.useEnvironmentMap ?? true;
        this.matcapTexture = this.createDefaultMatcapTexture();

        // Scene
        this.scene = new THREE.Scene();
        // Remove solid background to allow CSS gradient to show through
        this.scene.background = null;

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
        this.camera.position.set(100, 100, 100);

        // Renderer with alpha enabled for transparent background
        this.renderer = new THREE.WebGLRenderer({
            antialias: options.antialias ?? true,
            alpha: true // Enable transparency
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        // Set clear color with alpha = 0 for full transparency
        this.renderer.setClearColor(0x000000, 0);
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.setupLights();
        this.setupGrid();
        this.setupPostProcessing();
        this.updateSceneEnvironment();

        // MBS 可视化组件
        if (options.enableSelection !== false) {
            this.selectionManager = new SelectionManager(
                this.scene,
                this.camera,
                this.renderer.domElement,
                options.selectionOptions
            );
            this.selectionManager.onSelectionChange(() => {
                this.updateOutlineTargets();
            });
        }
        this.frameVisualizer = new FrameVisualizer(this.scene, options.frameOptions);
        this.jointVisualizer = new JointVisualizer(this.scene, options.jointOptions);

        this.animate();

        // Handle resize
        this.onResizeHandler = this.onResize.bind(this);
        window.addEventListener('resize', this.onResizeHandler);
    }

    private setupLights(): void {
        // 环境光 - 提供基础照明，确保所有面都能被照亮
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambientLight);

        // 半球光 - 模拟天空和地面的反射光，提供更自然的照明
        const hemisphereLight = new THREE.HemisphereLight(0xe6edf7, 0x5d4b35, 0.55);
        hemisphereLight.position.set(0, 0, 1); // Z-up
        this.scene.add(hemisphereLight);

        // 主方向光 - 从右上方照射
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.25);
        directionalLight.position.set(180, 120, 200);
        this.scene.add(directionalLight);

        // 辅助方向光 - 从左下方照射，填补阴影
        const directionalLight2 = new THREE.DirectionalLight(0xbfd8ff, 0.42);
        directionalLight2.position.set(-160, -90, 70);
        this.scene.add(directionalLight2);

        // 侧面补光 - 增强侧面细节
        const directionalLight3 = new THREE.DirectionalLight(0xfff4dc, 0.6);
        directionalLight3.position.set(-90, 170, -120);
        this.scene.add(directionalLight3);

        const directionalLight4 = new THREE.DirectionalLight(0xffffff, 0.35);
        directionalLight4.position.set(0, 0, 260);
        this.scene.add(directionalLight4);
    }

    private setupGrid(): void {
        const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x333333);
        gridHelper.rotation.x = Math.PI / 2; // Z-up
        this.scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(50);
        this.scene.add(axesHelper);
    }

    private setupPostProcessing(): void {
        if (!this.postProcessingEnabled) {
            this.composer = null;
            this.outlinePass = null;
            return;
        }

        const renderTarget = new THREE.WebGLRenderTarget(this.container.clientWidth, this.container.clientHeight, {
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: true,
            stencilBuffer: false
        });
        renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
        renderTarget.samples = 4;

        this.composer = new EffectComposer(this.renderer, renderTarget);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        if (this.outlineEnabled) {
            this.outlinePass = new OutlinePass(
                new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
                this.scene,
                this.camera
            );
            this.outlinePass.visibleEdgeColor.set(0x6ec8ff);
            this.outlinePass.hiddenEdgeColor.set(0x1d4e6b);
            this.outlinePass.edgeStrength = 4.5;
            this.outlinePass.edgeThickness = 1.2;
            this.outlinePass.pulsePeriod = 0;
            this.composer.addPass(this.outlinePass);
        }

        const gammaPass = new ShaderPass(GammaCorrectionShader);
        this.composer.addPass(gammaPass);
    }

    private createDefaultMatcapTexture(size: number = 128): THREE.DataTexture {
        const data = new Uint8Array(size * size * 4);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = (x / (size - 1)) * 2 - 1;
                const v = (y / (size - 1)) * 2 - 1;
                const r2 = u * u + v * v;
                const idx = (y * size + x) * 4;

                if (r2 > 1.0) {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 0;
                    continue;
                }

                const nz = Math.sqrt(1 - r2);
                const key = 0.35 + 0.65 * Math.max(0, nz);
                const rim = Math.pow(1 - nz, 1.8);
                const spec = Math.pow(Math.max(0, nz), 18.0);

                const base = 0.22 + 0.58 * key;
                const red = Math.min(1, base + 0.16 * spec + 0.08 * rim);
                const green = Math.min(1, base + 0.20 * spec + 0.12 * rim);
                const blue = Math.min(1, base + 0.24 * spec + 0.16 * rim);

                data[idx] = Math.floor(red * 255);
                data[idx + 1] = Math.floor(green * 255);
                data[idx + 2] = Math.floor(blue * 255);
                data[idx + 3] = 255;
            }
        }

        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    private ensureEnvironmentMap(): THREE.Texture {
        if (this.environmentTexture) {
            return this.environmentTexture;
        }

        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        const environmentScene = new RoomEnvironment();
        const envRT = this.pmremGenerator.fromScene(environmentScene, 0.04);
        this.environmentTexture = envRT.texture;
        return this.environmentTexture;
    }

    private updateSceneEnvironment(): void {
        if (this.materialMode === 'pbr' && this.useEnvironmentMap) {
            this.scene.environment = this.ensureEnvironmentMap();
        } else {
            this.scene.environment = null;
        }
    }

    private createSurfaceMaterial(color: number): THREE.Material {
        switch (this.materialMode) {
            case 'matcap':
                return new THREE.MeshMatcapMaterial({
                    color,
                    matcap: this.matcapTexture,
                    side: THREE.FrontSide
                });
            case 'pbr':
                return new THREE.MeshPhysicalMaterial({
                    color,
                    roughness: 0.55,
                    metalness: 0.05,
                    clearcoat: 0.02,
                    clearcoatRoughness: 0.7,
                    envMapIntensity: 0.8,
                    side: THREE.FrontSide
                });
            case 'flat':
                return new THREE.MeshStandardMaterial({
                    color,
                    metalness: 0,
                    roughness: 0.88,
                    flatShading: true,
                    side: THREE.FrontSide
                });
            case 'phong':
                return new THREE.MeshPhongMaterial({
                    color,
                    shininess: 36,
                    specular: new THREE.Color(0x2f2f2f),
                    side: THREE.FrontSide
                });
            default:
                return new THREE.MeshMatcapMaterial({
                    color,
                    matcap: this.matcapTexture,
                    side: THREE.FrontSide
                });
        }
    }

    private extractMaterialColor(material: THREE.Material | THREE.Material[] | undefined): number {
        const candidate = Array.isArray(material) ? material[0] : material;
        if (!candidate) {
            return 0x808080;
        }
        const meshMaterial = candidate as THREE.MeshStandardMaterial;
        if (meshMaterial.color instanceof THREE.Color) {
            return meshMaterial.color.getHex();
        }
        return 0x808080;
    }

    private applyMeshMaterial(mesh: THREE.Mesh, nextBaseMaterial: THREE.Material): void {
        const state = mesh.userData.viewerMaterialState as ViewerManagedMaterialState | undefined;

        if (state?.managedByViewer && state.baseMaterial !== nextBaseMaterial) {
            state.baseMaterial.dispose();
        }

        mesh.userData.viewerMaterialState = {
            managedByViewer: true,
            baseMaterial: nextBaseMaterial
        } as ViewerManagedMaterialState;

        mesh.material = nextBaseMaterial;
    }

    private updateManagedMeshMaterials(): void {
        this.selectionManager?.clearSelection();

        this.meshes.forEach((mesh) => {
            const state = mesh.userData.viewerMaterialState as ViewerManagedMaterialState | undefined;
            if (!state?.managedByViewer) {
                return;
            }

            const color = this.extractMaterialColor(state.baseMaterial);
            const nextMaterial = this.createSurfaceMaterial(color);
            this.applyMeshMaterial(mesh, nextMaterial);
        });

        this.updateOutlineTargets();
    }

    private updateOutlineTargets(): void {
        if (!this.outlinePass) {
            return;
        }

        const selectedObjects = this.getSelectedIds()
            .map(id => this.meshes.get(id))
            .filter((mesh): mesh is THREE.Mesh => Boolean(mesh));

        this.outlinePass.selectedObjects = selectedObjects;
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();

        if (this.composer && this.postProcessingEnabled) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    private onResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.composer?.setSize(width, height);
        this.outlinePass?.setSize(width, height);
    }

    addMeshFromData(id: string, meshData: MeshData, material?: THREE.Material): THREE.Mesh {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
        geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

        const baseMaterial = material ?? this.createSurfaceMaterial(0x808080);

        const mesh = new THREE.Mesh(geometry, baseMaterial);
        mesh.userData.viewerMaterialState = {
            managedByViewer: !material,
            baseMaterial
        } as ViewerManagedMaterialState;

        const edgesGeometry = new THREE.EdgesGeometry(geometry, 25);
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: 0x1a1a1a,
            transparent: true,
            opacity: 0.75,
            depthTest: true,
            depthWrite: false,
            toneMapped: false
        });
        const edgeOverlay = new THREE.LineSegments(edgesGeometry, edgeMaterial);
        edgeOverlay.visible = this.edgeLayerVisible;
        edgeOverlay.renderOrder = 2;
        edgeOverlay.raycast = () => undefined;
        mesh.add(edgeOverlay);
        this.meshEdges.set(id, edgeOverlay);

        this.scene.add(mesh);
        this.meshes.set(id, mesh);

        // 注册到选择管理器
        if (this.selectionManager) {
            this.selectionManager.registerObject(id, mesh);
        }

        this.updateOutlineTargets();

        return mesh;
    }

    removeMesh(id: string): void {
        const mesh = this.meshes.get(id);
        if (mesh) {
            // 从选择管理器注销
            if (this.selectionManager) {
                this.selectionManager.unregisterObject(id);
            }

            const edgeOverlay = this.meshEdges.get(id);
            if (edgeOverlay) {
                mesh.remove(edgeOverlay);
                edgeOverlay.geometry.dispose();
                if (edgeOverlay.material instanceof THREE.Material) {
                    edgeOverlay.material.dispose();
                }
                this.meshEdges.delete(id);
            }

            this.scene.remove(mesh);
            mesh.geometry.dispose();

            const state = mesh.userData.viewerMaterialState as ViewerManagedMaterialState | undefined;
            if (state?.baseMaterial) {
                state.baseMaterial.dispose();
            } else if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }

            this.meshes.delete(id);
            this.updateOutlineTargets();
        }
    }

    getMesh(id: string): THREE.Mesh | undefined {
        return this.meshes.get(id);
    }

    setVisibility(id: string, visible: boolean): void {
        const mesh = this.meshes.get(id);
        if (mesh) {
            mesh.visible = visible;
        }
        const edgeOverlay = this.meshEdges.get(id);
        if (edgeOverlay) {
            edgeOverlay.visible = visible && this.edgeLayerVisible;
        }
    }

    setMeshColor(id: string, color: number): void {
        const mesh = this.meshes.get(id);
        if (!mesh) {
            return;
        }

        const updateColor = (mat: THREE.Material): void => {
            const typed = mat as THREE.MeshStandardMaterial;
            if (typed.color instanceof THREE.Color) {
                typed.color.setHex(color);
                typed.needsUpdate = true;
            }
        };

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(updateColor);
        } else {
            updateColor(mesh.material);
        }

        const state = mesh.userData.viewerMaterialState as ViewerManagedMaterialState | undefined;
        if (state?.baseMaterial) {
            const base = state.baseMaterial as THREE.MeshStandardMaterial;
            if (base.color instanceof THREE.Color) {
                base.color.setHex(color);
                base.needsUpdate = true;
            }
        }
    }

    setMeshPosition(id: string, offset: { x: number; y: number; z: number }): void {
        const mesh = this.meshes.get(id);
        if (mesh) {
            mesh.position.set(offset.x, offset.y, offset.z);
        }
    }

    fitToView(): void {
        const box = new THREE.Box3();
        this.meshes.forEach(mesh => {
            box.expandByObject(mesh);
        });

        if (!box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            this.camera.position.set(
                center.x + maxDim,
                center.y + maxDim,
                center.z + maxDim
            );
            this.controls.target.copy(center);
            this.controls.update();
        }
    }

    setMaterialMode(mode: MaterialMode): void {
        if (this.materialMode === mode) {
            return;
        }

        this.materialMode = mode;
        this.updateSceneEnvironment();
        this.updateManagedMeshMaterials();
    }

    getMaterialMode(): MaterialMode {
        return this.materialMode;
    }

    setEdgeLayerVisible(visible: boolean): void {
        this.edgeLayerVisible = visible;
        this.meshEdges.forEach((edgeOverlay, id) => {
            const mesh = this.meshes.get(id);
            edgeOverlay.visible = visible && (mesh?.visible ?? true);
        });
    }

    setPostProcessingEnabled(enabled: boolean): void {
        if (this.postProcessingEnabled === enabled) {
            return;
        }

        this.postProcessingEnabled = enabled;

        if (!enabled) {
            this.composer = null;
            this.outlinePass = null;
            return;
        }

        this.setupPostProcessing();
        this.updateOutlineTargets();
    }

    setOutlineEnabled(enabled: boolean): void {
        if (this.outlineEnabled === enabled) {
            return;
        }

        this.outlineEnabled = enabled;

        if (!this.postProcessingEnabled) {
            return;
        }

        this.setupPostProcessing();
        this.updateOutlineTargets();
    }

    dispose(): void {
        window.removeEventListener('resize', this.onResizeHandler);
        this.meshes.forEach((_mesh, id) => this.removeMesh(id));
        this.selectionManager?.dispose();
        this.frameVisualizer.dispose();
        this.jointVisualizer.dispose();

        this.composer?.dispose();
        this.pmremGenerator?.dispose();
        this.environmentTexture?.dispose();
        this.matcapTexture.dispose();

        this.renderer.dispose();
        this.controls.dispose();
    }

    // ========================================================================
    // 选择管理 API
    // ========================================================================

    /**
     * 选择对象
     */
    select(id: string): void {
        this.selectionManager?.select(id);
    }

    /**
     * 取消选择
     */
    deselect(id: string): void {
        this.selectionManager?.deselect(id);
    }

    /**
     * 清除所有选择
     */
    clearSelection(): void {
        this.selectionManager?.clearSelection();
    }

    /**
     * 获取选中的对象 ID
     */
    getSelectedIds(): string[] {
        return this.selectionManager?.getSelectedIds() ?? [];
    }

    /**
     * 监听选择变化
     */
    onSelectionChange(callback: SelectionCallback): void {
        this.selectionManager?.onSelectionChange(callback);
    }

    // ========================================================================
    // 标架可视化 API
    // ========================================================================

    /**
     * 添加标架
     */
    addFrame(data: FrameData): THREE.Group {
        return this.frameVisualizer.addFrame(data);
    }

    /**
     * 更新标架
     */
    updateFrame(data: FrameData): void {
        this.frameVisualizer.updateFrame(data);
    }

    /**
     * 移除标架
     */
    removeFrame(id: string): void {
        this.frameVisualizer.removeFrame(id);
    }

    /**
     * 设置标架可见性
     */
    setFrameVisible(id: string, visible: boolean): void {
        this.frameVisualizer.setFrameVisible(id, visible);
    }

    /**
     * 设置所有标架可见性
     */
    setAllFramesVisible(visible: boolean): void {
        this.frameVisualizer.setAllFramesVisible(visible);
    }

    // ========================================================================
    // 关节可视化 API
    // ========================================================================

    /**
     * 添加关节
     */
    addJoint(data: JointData): THREE.Group {
        return this.jointVisualizer.addJoint(data);
    }

    /**
     * 更新关节
     */
    updateJoint(data: JointData): void {
        this.jointVisualizer.updateJoint(data);
    }

    /**
     * 移除关节
     */
    removeJoint(id: string): void {
        this.jointVisualizer.removeJoint(id);
    }

    /**
     * 设置关节可见性
     */
    setJointVisible(id: string, visible: boolean): void {
        this.jointVisualizer.setJointVisible(id, visible);
    }

    /**
     * 设置所有关节可见性
     */
    setAllJointsVisible(visible: boolean): void {
        this.jointVisualizer.setAllJointsVisible(visible);
    }

    // ========================================================================
    // 场景访问
    // ========================================================================

    /**
     * 获取 Three.js 场景
     */
    getScene(): THREE.Scene {
        return this.scene;
    }

    /**
     * 获取相机
     */
    getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    /**
     * 获取渲染器
     */
    getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }

    /**
     * 从屏幕坐标获取射线 (用于拾取面法向)
     */
    getRayFromScreenPoint(x: number, y: number): { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } } | null {
        const rect = this.renderer.domElement.getBoundingClientRect();

        // 归一化设备坐标 (NDC): -1 到 +1
        const mouse = new THREE.Vector2(
            ((x / rect.width) * 2) - 1,
            -((y / rect.height) * 2) + 1
        );

        // 创建射线
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const ray = raycaster.ray;

        return {
            origin: {
                x: ray.origin.x,
                y: ray.origin.y,
                z: ray.origin.z
            },
            direction: {
                x: ray.direction.x,
                y: ray.direction.y,
                z: ray.direction.z
            }
        };
    }
}
