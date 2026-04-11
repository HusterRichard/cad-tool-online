import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import {
    computeCylinderGuideGeometry,
    sampleCirclePolyline,
    type EdgeData,
    type MeshData,
    type Vec3
} from '@cadtool-online/core';
import {
    SelectionManager,
    type SelectionCallback,
    type SelectionFilter,
    type SelectionOptions
} from './SelectionManager';
import { FrameVisualizer, type FrameData, type FrameVisualizerOptions } from './FrameVisualizer';
import { JointVisualizer, type JointData, type JointVisualizerOptions } from './JointVisualizer';
import { RenderFrameBudget } from './RenderFrameBudget';

export type MaterialMode = 'matcap' | 'pbr' | 'flat' | 'phong';
export type VisualPreset = 'cad' | 'cinematic';

export interface ThreeViewerOptions {
    backgroundColor?: number;
    antialias?: boolean;
    enableSelection?: boolean;
    selectionOptions?: SelectionOptions;
    frameOptions?: FrameVisualizerOptions;
    jointOptions?: JointVisualizerOptions;
    materialMode?: MaterialMode;
    visualPreset?: VisualPreset;
    enablePostProcessing?: boolean;
    enableOutline?: boolean;
    useEnvironmentMap?: boolean;
}

interface ViewerManagedMaterialState {
    managedByViewer: boolean;
    baseMaterial: THREE.Material;
}

type EdgeOverlay = LineSegments2;

export type MarkerGuideData =
    | {
          kind: 'circle';
          center: Vec3;
          normal: Vec3;
          radius: number;
      }
    | {
          kind: 'cylinder';
          axisStart: Vec3;
          axisEnd: Vec3;
          radius: number;
          viewDirection: Vec3;
          snapCircleCenter?: Vec3;
      };

export interface SelectionBoundsBox {
    min: Vec3;
    max: Vec3;
}

export class ThreeViewer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private container: HTMLElement;
    private meshes: Map<string, THREE.Mesh> = new Map();
    private meshEdges: Map<string, EdgeOverlay> = new Map();

    private materialMode: MaterialMode;
    private visualPreset: VisualPreset;
    private postProcessingEnabled: boolean;
    private outlineEnabled: boolean;
    private useEnvironmentMap: boolean;
    private edgeLayerVisible = true;

    private composer: EffectComposer | null = null;
    private outlinePass: OutlinePass | null = null;
    private fxaaPass: ShaderPass | null = null;

    private pmremGenerator: THREE.PMREMGenerator | null = null;
    private environmentTexture: THREE.Texture | null = null;
    private matcapTexture: THREE.DataTexture;

    private ambientLight: THREE.AmbientLight | null = null;
    private hemisphereLight: THREE.HemisphereLight | null = null;
    private keyLight: THREE.DirectionalLight | null = null;
    private fillLight: THREE.DirectionalLight | null = null;
    private rimLight: THREE.DirectionalLight | null = null;
    private topLight: THREE.DirectionalLight | null = null;
    private edgeMaterial: LineMaterial | null = null;
    private markerGuideGroup: THREE.Group | null = null;
    private markerGuideMaterial: THREE.LineBasicMaterial | null = null;
    private selectionBoundsGroup: THREE.Group | null = null;
    private hoverBoundsGroup: THREE.Group | null = null;
    private readonly renderFrameBudget = new RenderFrameBudget();

    private readonly onResizeHandler: () => void;
    private readonly onControlStartHandler: () => void;
    private readonly onControlChangeHandler: () => void;
    private readonly onControlEndHandler: () => void;
    private sceneBoundsSphere: THREE.Sphere | null = null;
    private sceneBoundsDirty = true;

    // MBS 可视化组件
    private selectionManager: SelectionManager | null = null;
    private frameVisualizer: FrameVisualizer;
    private jointVisualizer: JointVisualizer;

    constructor(container: HTMLElement, options: ThreeViewerOptions = {}) {
        this.container = container;
        this.materialMode = options.materialMode ?? 'phong';
        this.visualPreset = options.visualPreset ?? 'cad';
        this.postProcessingEnabled = options.enablePostProcessing ?? true;
        this.outlineEnabled =
            options.enableOutline ?? options.selectionOptions?.outlineEnabled ?? true;
        this.useEnvironmentMap = options.useEnvironmentMap ?? true;
        this.matcapTexture = this.createDefaultMatcapTexture();

        // Scene
        this.scene = new THREE.Scene();
        const backgroundColor = new THREE.Color(options.backgroundColor ?? 0xe4e8ed);
        this.scene.background = backgroundColor;

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
        this.camera.position.set(100, 100, 100);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: options.antialias ?? true,
            alpha: false,
            logarithmicDepthBuffer: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.02;
        this.renderer.setClearColor(backgroundColor, 1);
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = false;
        this.onControlStartHandler = () => {
            this.selectionManager?.setHoverEnabled(false);
            this.requestRender();
        };
        this.onControlChangeHandler = () => {
            this.requestRender();
        };
        this.onControlEndHandler = () => {
            this.selectionManager?.setHoverEnabled(true);
            this.updateCameraClippingRange();
            this.requestRender();
        };
        this.controls.addEventListener('start', this.onControlStartHandler);
        this.controls.addEventListener('change', this.onControlChangeHandler);
        this.controls.addEventListener('end', this.onControlEndHandler);

        this.setupLights();
        this.setupGrid();
        this.setupPostProcessing();
        this.applyVisualPreset();
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
                this.syncFrameSelectionVisuals();
                this.syncJointSelectionVisuals();
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
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.62);
        this.scene.add(this.ambientLight);

        // 半球光 - 模拟天空和地面的反射光，提供更自然的照明
        this.hemisphereLight = new THREE.HemisphereLight(0xf5f8fc, 0xa7afb8, 0.58);
        this.hemisphereLight.position.set(0, 0, 1); // Z-up
        this.scene.add(this.hemisphereLight);

        // 主方向光 - 从右上方照射
        this.keyLight = new THREE.DirectionalLight(0xffffff, 1.02);
        this.keyLight.position.set(190, 135, 250);
        this.scene.add(this.keyLight);

        // 辅助方向光 - 从左下方照射，填补阴影
        this.fillLight = new THREE.DirectionalLight(0xf1f5fa, 0.46);
        this.fillLight.position.set(-185, -105, 145);
        this.scene.add(this.fillLight);

        // 侧面补光 - 增强侧面细节
        this.rimLight = new THREE.DirectionalLight(0xfaf3e4, 0.28);
        this.rimLight.position.set(-130, 200, -70);
        this.scene.add(this.rimLight);

        this.topLight = new THREE.DirectionalLight(0xffffff, 0.22);
        this.topLight.position.set(0, 0, 360);
        this.scene.add(this.topLight);
    }

    private applyVisualPreset(): void {
        if (this.visualPreset === 'cad') {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.02;

            if (this.ambientLight) {
                this.ambientLight.color.setHex(0xffffff);
                this.ambientLight.intensity = 0.74;
            }
            if (this.hemisphereLight) {
                this.hemisphereLight.color.setHex(0xf7fafc);
                this.hemisphereLight.groundColor.setHex(0xb8bfc7);
                this.hemisphereLight.intensity = 0.54;
            }
            if (this.keyLight) {
                this.keyLight.color.setHex(0xffffff);
                this.keyLight.intensity = 1.08;
                this.keyLight.position.set(175, 140, 225);
            }
            if (this.fillLight) {
                this.fillLight.color.setHex(0xf4f7fb);
                this.fillLight.intensity = 0.42;
                this.fillLight.position.set(-175, -105, 135);
            }
            if (this.rimLight) {
                this.rimLight.color.setHex(0xfbf3e5);
                this.rimLight.intensity = 0.24;
                this.rimLight.position.set(-115, 185, -75);
            }
            if (this.topLight) {
                this.topLight.color.setHex(0xffffff);
                this.topLight.intensity = 0.18;
                this.topLight.position.set(0, 0, 300);
            }

            if (this.outlinePass) {
                this.outlinePass.visibleEdgeColor.set(0x2f2f2f);
                this.outlinePass.hiddenEdgeColor.set(0x2f2f2f);
                this.outlinePass.edgeStrength = 2.2;
                this.outlinePass.edgeThickness = 1.0;
                this.outlinePass.pulsePeriod = 0;
            }
            if (this.fxaaPass) {
                this.fxaaPass.enabled = false;
            }
            if (this.edgeMaterial) {
                this.edgeMaterial.color.set(0x262626);
                this.edgeMaterial.opacity = 0.98;
                this.edgeMaterial.linewidth = 1.35;
            }
            return;
        }

        // cinematic preset
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;

        if (this.ambientLight) {
            this.ambientLight.color.setHex(0xffffff);
            this.ambientLight.intensity = 0.45;
        }
        if (this.hemisphereLight) {
            this.hemisphereLight.color.setHex(0xe6edf7);
            this.hemisphereLight.groundColor.setHex(0x5d4b35);
            this.hemisphereLight.intensity = 0.55;
        }
        if (this.keyLight) {
            this.keyLight.color.setHex(0xffffff);
            this.keyLight.intensity = 1.25;
            this.keyLight.position.set(180, 120, 200);
        }
        if (this.fillLight) {
            this.fillLight.color.setHex(0xbfd8ff);
            this.fillLight.intensity = 0.42;
            this.fillLight.position.set(-160, -90, 70);
        }
        if (this.rimLight) {
            this.rimLight.color.setHex(0xfff4dc);
            this.rimLight.intensity = 0.6;
            this.rimLight.position.set(-90, 170, -120);
        }
        if (this.topLight) {
            this.topLight.color.setHex(0xffffff);
            this.topLight.intensity = 0.35;
            this.topLight.position.set(0, 0, 260);
        }

        if (this.outlinePass) {
            this.outlinePass.visibleEdgeColor.set(0x6ec8ff);
            this.outlinePass.hiddenEdgeColor.set(0x1d4e6b);
            this.outlinePass.edgeStrength = 4.5;
            this.outlinePass.edgeThickness = 1.2;
            this.outlinePass.pulsePeriod = 0;
        }
        if (this.fxaaPass) {
            this.fxaaPass.enabled = true;
        }
        if (this.edgeMaterial) {
            this.edgeMaterial.color.set(0x2d2d2d);
            this.edgeMaterial.opacity = 0.9;
            this.edgeMaterial.linewidth = 1.15;
        }
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
            this.fxaaPass = null;
            return;
        }

        const renderTarget = new THREE.WebGLRenderTarget(
            this.container.clientWidth,
            this.container.clientHeight,
            {
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType,
                depthBuffer: true,
                stencilBuffer: false
            }
        );
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

        this.fxaaPass = new ShaderPass(FXAAShader);
        this.updateFxaaResolution();
        this.composer.addPass(this.fxaaPass);

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }

    private createEdgeMaterial(): LineMaterial {
        const material = new LineMaterial({
            color: 0x262626,
            linewidth: 1.35,
            transparent: true,
            opacity: 0.98,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
            worldUnits: false
        });
        this.updateLineMaterialResolution(material);
        return material;
    }

    private updateLineMaterialResolution(material: LineMaterial): void {
        material.resolution.set(
            Math.max(this.container.clientWidth * this.renderer.getPixelRatio(), 1),
            Math.max(this.container.clientHeight * this.renderer.getPixelRatio(), 1)
        );
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
                const green = Math.min(1, base + 0.2 * spec + 0.12 * rim);
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
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1,
                    side: THREE.FrontSide
                });
            case 'pbr':
                return new THREE.MeshPhysicalMaterial({
                    color,
                    roughness: 0.55,
                    metalness: 0.05,
                    clearcoat: 0.02,
                    clearcoatRoughness: 0.7,
                    envMapIntensity: 0.45,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1,
                    side: THREE.FrontSide
                });
            case 'flat':
                return new THREE.MeshStandardMaterial({
                    color,
                    metalness: 0,
                    roughness: 0.88,
                    flatShading: true,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1,
                    side: THREE.FrontSide
                });
            case 'phong':
                return new THREE.MeshPhongMaterial({
                    color,
                    shininess: 20,
                    specular: new THREE.Color(0x1a1a1a),
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1,
                    side: THREE.FrontSide
                });
            default:
                return new THREE.MeshMatcapMaterial({
                    color,
                    matcap: this.matcapTexture,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1,
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

        this.meshes.forEach(mesh => {
            const state = mesh.userData.viewerMaterialState as
                | ViewerManagedMaterialState
                | undefined;
            if (!state?.managedByViewer) {
                return;
            }

            const color = this.extractMaterialColor(state.baseMaterial);
            const nextMaterial = this.createSurfaceMaterial(color);
            this.applyMeshMaterial(mesh, nextMaterial);
        });

        this.updateOutlineTargets();
    }

    /** 超过此数量的选中对象时跳过 OutlinePass，避免 GPU 过载 */
    private static readonly OUTLINE_MAX_OBJECTS = 8;

    /** 选中变更后跳过后处理的帧数（提供即时视觉反馈） */
    private _postProcessSkipFrames = 0;

    private updateOutlineTargets(): void {
        if (!this.outlinePass) {
            this.requestRender();
            return;
        }

        const selectedObjects = this.getSelectedIds()
            .map(id => this.meshes.get(id))
            .filter((mesh): mesh is THREE.Mesh => Boolean(mesh));

        if (selectedObjects.length > ThreeViewer.OUTLINE_MAX_OBJECTS) {
            this.outlinePass.selectedObjects = [];
        } else {
            this.outlinePass.selectedObjects = selectedObjects;
        }

        // 选中变更后跳过 1 帧后处理，让高亮材质即时可见
        this._postProcessSkipFrames = 1;
        this.requestRender(this.shouldUsePostProcessing() ? 2 : 1);
    }

    private shouldUsePostProcessing(): boolean {
        if (!this.postProcessingEnabled || !this.composer) {
            return false;
        }

        return true;
    }

    private _lastFrameLog = 0;

    private requestRender(frameCount: number = 1): void {
        this.renderFrameBudget.schedule(frameCount);
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        if (!this.renderFrameBudget.consume()) {
            return;
        }
        this.controls.update();
        this.updateCameraClippingRange();

        const t0 = performance.now();
        const composer = this.composer;
        if (this._postProcessSkipFrames > 0) {
            // 选中切换后跳过后处理，直接渲染以提供即时反馈
            this._postProcessSkipFrames--;
            this.renderer.render(this.scene, this.camera);
        } else if (this.shouldUsePostProcessing() && composer) {
            composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        const dt = performance.now() - t0;
        if (dt > 30 && t0 - this._lastFrameLog > 1000) {
            this._lastFrameLog = t0;
            const outlineCount = this.outlinePass?.selectedObjects?.length ?? 0;
            console.warn(`[animate] render=${dt.toFixed(1)}ms  outlineObjects=${outlineCount}`);
        }
    }

    private onResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const pixelRatio = Math.min(window.devicePixelRatio, 2);

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(pixelRatio);
        this.composer?.setPixelRatio(pixelRatio);
        this.renderer.setSize(width, height);
        this.composer?.setSize(width, height);
        this.outlinePass?.setSize(width, height);
        this.updateFxaaResolution();
        if (this.edgeMaterial) {
            this.updateLineMaterialResolution(this.edgeMaterial);
        }
        this.selectionManager?.setViewportSize(width, height);
        this.requestRender();
    }

    private updateFxaaResolution(): void {
        if (!this.fxaaPass) {
            return;
        }

        const width = Math.max(this.container.clientWidth, 1);
        const height = Math.max(this.container.clientHeight, 1);
        const pixelRatio = this.renderer.getPixelRatio();
        this.fxaaPass.material.uniforms['resolution'].value.set(
            1 / (width * pixelRatio),
            1 / (height * pixelRatio)
        );
    }

    private getMarkerGuideMaterial(): THREE.LineBasicMaterial {
        if (!this.markerGuideMaterial) {
            this.markerGuideMaterial = new THREE.LineBasicMaterial({
                color: 0x00f5ff,
                transparent: true,
                opacity: 0.98,
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            });
        }
        return this.markerGuideMaterial;
    }

    private buildGuideCircle(center: Vec3, normal: Vec3, radius: number): THREE.LineLoop | null {
        const points = sampleCirclePolyline(center, normal, radius, 64);
        if (points.length < 4) {
            return null;
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(
            points.slice(0, -1).map(point => new THREE.Vector3(point.x, point.y, point.z))
        );
        const circle = new THREE.LineLoop(geometry, this.getMarkerGuideMaterial());
        circle.renderOrder = 6;
        return circle;
    }

    private buildGuideSegments(segments: Array<[Vec3, Vec3]>): THREE.LineSegments | null {
        if (segments.length === 0) {
            return null;
        }

        const positions = new Float32Array(segments.length * 6);
        segments.forEach(([start, end], index) => {
            const offset = index * 6;
            positions[offset] = start.x;
            positions[offset + 1] = start.y;
            positions[offset + 2] = start.z;
            positions[offset + 3] = end.x;
            positions[offset + 4] = end.y;
            positions[offset + 5] = end.z;
        });

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const lineSegments = new THREE.LineSegments(geometry, this.getMarkerGuideMaterial());
        lineSegments.renderOrder = 6;
        return lineSegments;
    }

    private buildSelectionBoundsHelper(
        bounds: SelectionBoundsBox,
        color: number = 0x00d1ff
    ): THREE.Box3Helper | null {
        const min = new THREE.Vector3(
            Math.min(bounds.min.x, bounds.max.x),
            Math.min(bounds.min.y, bounds.max.y),
            Math.min(bounds.min.z, bounds.max.z)
        );
        const max = new THREE.Vector3(
            Math.max(bounds.min.x, bounds.max.x),
            Math.max(bounds.min.y, bounds.max.y),
            Math.max(bounds.min.z, bounds.max.z)
        );

        if (
            !Number.isFinite(min.x) ||
            !Number.isFinite(min.y) ||
            !Number.isFinite(min.z) ||
            !Number.isFinite(max.x) ||
            !Number.isFinite(max.y) ||
            !Number.isFinite(max.z)
        ) {
            return null;
        }

        const helper = new THREE.Box3Helper(new THREE.Box3(min, max), color);
        const material = Array.isArray(helper.material) ? helper.material[0] : helper.material;
        material.depthTest = false;
        material.depthWrite = false;
        material.transparent = true;
        material.opacity = 0.98;
        material.toneMapped = false;
        helper.renderOrder = 7;
        helper.raycast = () => undefined;
        return helper;
    }

    private clearSelectionBoundsBoxesInternal(): void {
        if (!this.selectionBoundsGroup) {
            return;
        }

        this.selectionBoundsGroup.traverse(child => {
            if (child instanceof THREE.LineSegments) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        this.scene.remove(this.selectionBoundsGroup);
        this.selectionBoundsGroup = null;
    }

    private clearHoverBoundsBoxInternal(): void {
        if (!this.hoverBoundsGroup) {
            return;
        }

        this.hoverBoundsGroup.traverse(child => {
            if (child instanceof THREE.LineSegments) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        this.scene.remove(this.hoverBoundsGroup);
        this.hoverBoundsGroup = null;
    }

    clearMarkerGuide(): void {
        if (!this.markerGuideGroup) {
            return;
        }

        this.markerGuideGroup.traverse(child => {
            if (
                child instanceof THREE.Line ||
                child instanceof THREE.LineLoop ||
                child instanceof THREE.LineSegments
            ) {
                child.geometry.dispose();
            }
        });
        this.scene.remove(this.markerGuideGroup);
        this.markerGuideGroup = null;
        this.requestRender();
    }

    setMarkerGuide(guide: MarkerGuideData | null): void {
        this.clearMarkerGuide();
        if (!guide) {
            return;
        }

        const group = new THREE.Group();
        if (guide.kind === 'circle') {
            const circle = this.buildGuideCircle(guide.center, guide.normal, guide.radius);
            if (circle) {
                group.add(circle);
            }
        } else {
            const geometry = computeCylinderGuideGeometry(
                guide.axisStart,
                guide.axisEnd,
                guide.radius,
                guide.viewDirection,
                guide.snapCircleCenter
            );
            if (geometry) {
                const rails = this.buildGuideSegments([
                    [geometry.railAStart, geometry.railAEnd],
                    [geometry.railBStart, geometry.railBEnd]
                ]);
                if (rails) {
                    group.add(rails);
                }

                const startCircle = this.buildGuideCircle(
                    geometry.axisStart,
                    geometry.axisDirection,
                    geometry.radius
                );
                const endCircle = this.buildGuideCircle(
                    geometry.axisEnd,
                    geometry.axisDirection,
                    geometry.radius
                );
                const snapCircle = geometry.snapCircleCenter
                    ? this.buildGuideCircle(
                          geometry.snapCircleCenter,
                          geometry.axisDirection,
                          geometry.radius
                      )
                    : null;
                if (startCircle) {
                    group.add(startCircle);
                }
                if (endCircle) {
                    group.add(endCircle);
                }
                if (snapCircle) {
                    group.add(snapCircle);
                }
            }
        }

        if (group.children.length === 0) {
            return;
        }

        group.renderOrder = 6;
        this.markerGuideGroup = group;
        this.scene.add(group);
        this.requestRender();
    }

    addMeshFromData(
        id: string,
        meshData: MeshData,
        material?: THREE.Material,
        edgeData?: EdgeData
    ): THREE.Mesh {
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

        const edgePositions =
            edgeData && edgeData.vertices.length >= 6
                ? edgeData.vertices
                : (() => {
                      const fallbackEdges = new THREE.EdgesGeometry(geometry, 3);
                      const fallbackPositions = fallbackEdges.getAttribute('position');
                      const positions = new Float32Array(
                          fallbackPositions.array as ArrayLike<number>
                      );
                      fallbackEdges.dispose();
                      return positions;
                  })();
        const edgesGeometry = new LineSegmentsGeometry();
        edgesGeometry.setPositions(edgePositions);
        const edgeMaterial = this.edgeMaterial ?? (this.edgeMaterial = this.createEdgeMaterial());
        const edgeOverlay = new LineSegments2(edgesGeometry, edgeMaterial);
        edgeOverlay.visible = this.edgeLayerVisible;
        edgeOverlay.renderOrder = 4;
        edgeOverlay.raycast = () => undefined;
        edgeOverlay.userData.viewerEdgeOverlay = true;
        mesh.add(edgeOverlay);
        this.meshEdges.set(id, edgeOverlay);

        this.scene.add(mesh);
        this.meshes.set(id, mesh);
        this.markSceneBoundsDirty();

        // 注册到选择管理器
        if (this.selectionManager) {
            this.selectionManager.registerObject(id, mesh);
        }

        this.updateOutlineTargets();
        this.requestRender();

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
                this.meshEdges.delete(id);
            }

            this.scene.remove(mesh);
            mesh.geometry.dispose();

            const state = mesh.userData.viewerMaterialState as
                | ViewerManagedMaterialState
                | undefined;
            if (state?.baseMaterial) {
                state.baseMaterial.dispose();
            } else if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }

            this.meshes.delete(id);
            this.updateOutlineTargets();
            this.markSceneBoundsDirty();
            this.requestRender();
        }
    }

    getMesh(id: string): THREE.Mesh | undefined {
        return this.meshes.get(id);
    }

    setVisibility(id: string, visible: boolean): void {
        const mesh = this.meshes.get(id);
        if (mesh) {
            mesh.visible = visible;
            this.markSceneBoundsDirty();
        }
        const edgeOverlay = this.meshEdges.get(id);
        if (edgeOverlay) {
            edgeOverlay.visible = visible && this.edgeLayerVisible;
        }
        this.requestRender();
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
        this.requestRender();
    }

    setMeshPosition(id: string, offset: { x: number; y: number; z: number }): void {
        const mesh = this.meshes.get(id);
        if (mesh) {
            mesh.position.set(offset.x, offset.y, offset.z);
            this.markSceneBoundsDirty();
            this.requestRender();
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

            this.camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim);
            this.controls.target.copy(center);
            this.controls.update();
            this.sceneBoundsSphere = box.getBoundingSphere(new THREE.Sphere());
            this.sceneBoundsDirty = false;
            this.updateCameraClippingRange();
            this.requestRender();
        }
    }

    setMaterialMode(mode: MaterialMode): void {
        if (this.materialMode === mode) {
            return;
        }

        this.materialMode = mode;
        this.updateSceneEnvironment();
        this.updateManagedMeshMaterials();
        this.requestRender();
    }

    getMaterialMode(): MaterialMode {
        return this.materialMode;
    }

    setVisualPreset(preset: VisualPreset): void {
        if (this.visualPreset === preset) {
            return;
        }
        this.visualPreset = preset;
        this.applyVisualPreset();
        this.requestRender();
    }

    getVisualPreset(): VisualPreset {
        return this.visualPreset;
    }

    setEdgeLayerVisible(visible: boolean): void {
        this.edgeLayerVisible = visible;
        this.meshEdges.forEach((edgeOverlay, id) => {
            const mesh = this.meshes.get(id);
            edgeOverlay.visible = visible && (mesh?.visible ?? true);
        });
        this.requestRender();
    }

    setPostProcessingEnabled(enabled: boolean): void {
        if (this.postProcessingEnabled === enabled) {
            return;
        }

        this.postProcessingEnabled = enabled;

        if (!enabled) {
            this.composer?.dispose();
            this.composer = null;
            this.outlinePass = null;
            this.fxaaPass = null;
            this.requestRender();
            return;
        }

        this.composer?.dispose();
        this.setupPostProcessing();
        this.applyVisualPreset();
        this.updateOutlineTargets();
        this.requestRender();
    }

    setOutlineEnabled(enabled: boolean): void {
        if (this.outlineEnabled === enabled) {
            return;
        }

        this.outlineEnabled = enabled;

        if (!this.postProcessingEnabled) {
            this.requestRender();
            return;
        }

        this.composer?.dispose();
        this.setupPostProcessing();
        this.applyVisualPreset();
        this.updateOutlineTargets();
        this.requestRender();
    }

    private markSceneBoundsDirty(): void {
        this.sceneBoundsDirty = true;
    }

    private rebuildSceneBoundsIfNeeded(): void {
        if (!this.sceneBoundsDirty) {
            return;
        }

        const box = new THREE.Box3();
        this.meshes.forEach(mesh => {
            if (mesh.visible) {
                box.expandByObject(mesh);
            }
        });

        if (box.isEmpty()) {
            this.sceneBoundsSphere = null;
        } else {
            this.sceneBoundsSphere = box.getBoundingSphere(new THREE.Sphere());
        }
        this.sceneBoundsDirty = false;
    }

    private updateCameraClippingRange(): void {
        this.rebuildSceneBoundsIfNeeded();
        if (!this.sceneBoundsSphere) {
            return;
        }

        const distance = this.camera.position.distanceTo(this.sceneBoundsSphere.center);
        const radius = Math.max(this.sceneBoundsSphere.radius, 1e-3);
        const targetNear = Math.max(0.01, distance - radius * 2.5);
        const targetFar = Math.max(targetNear + 10, distance + radius * 3.0);

        if (
            Math.abs(this.camera.near - targetNear) < 1e-3 &&
            Math.abs(this.camera.far - targetFar) < 1e-2
        ) {
            return;
        }

        this.camera.near = targetNear;
        this.camera.far = targetFar;
        this.camera.updateProjectionMatrix();
    }

    private syncFrameSelectionVisuals(): void {
        this.frameVisualizer.getAllFrameIds().forEach(id => {
            this.frameVisualizer.setFrameSelected(
                id,
                this.selectionManager?.isSelected(id) ?? false
            );
        });
    }

    private syncJointSelectionVisuals(): void {
        this.jointVisualizer.getAllJointIds().forEach(id => {
            this.jointVisualizer.setJointSelected(
                id,
                this.selectionManager?.isSelected(id) ?? false
            );
        });
    }

    dispose(): void {
        window.removeEventListener('resize', this.onResizeHandler);
        this.controls.removeEventListener('start', this.onControlStartHandler);
        this.controls.removeEventListener('change', this.onControlChangeHandler);
        this.controls.removeEventListener('end', this.onControlEndHandler);
        this.clearMarkerGuide();
        this.clearSelectionBoundsBoxesInternal();
        this.clearHoverBoundsBoxInternal();
        this.meshes.forEach((_mesh, id) => this.removeMesh(id));
        this.selectionManager?.dispose();
        this.frameVisualizer.dispose();
        this.jointVisualizer.dispose();

        this.composer?.dispose();
        this.pmremGenerator?.dispose();
        this.environmentTexture?.dispose();
        this.matcapTexture.dispose();
        this.markerGuideMaterial?.dispose();

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
     * 批量选择多个对象，只触发一次 outline 更新
     */
    selectMany(ids: string[]): void {
        this.selectionManager?.selectMany(ids);
        this.updateOutlineTargets();
    }

    /**
     * 替换当前选中集合（批量操作，只触发一次 outline 和视觉同步）
     */
    replaceSelection(ids: string[]): void {
        this.selectionManager?.replaceSelection(ids);
        this.syncFrameSelectionVisuals();
        this.syncJointSelectionVisuals();
        this.updateOutlineTargets();
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

    setSelectionEnabled(enabled: boolean): void {
        this.selectionManager?.setEnabled(enabled);
        this.requestRender();
    }

    setSelectionFilter(filter: SelectionFilter | null): void {
        this.selectionManager?.setSelectionFilter(filter);
        this.requestRender();
    }

    setHoveredId(id: string | null): void {
        this.selectionManager?.setHoveredId(id);
        this.requestRender();
    }

    setSelectionBoundsBoxes(boxes: SelectionBoundsBox[]): void {
        this.clearSelectionBoundsBoxesInternal();
        if (!Array.isArray(boxes) || boxes.length === 0) {
            return;
        }

        const group = new THREE.Group();
        boxes.forEach(bounds => {
            const helper = this.buildSelectionBoundsHelper(bounds);
            if (helper) {
                group.add(helper);
            }
        });

        if (group.children.length === 0) {
            return;
        }

        group.renderOrder = 7;
        this.selectionBoundsGroup = group;
        this.scene.add(group);
        this.requestRender();
    }

    setHoverBoundsBox(box: SelectionBoundsBox | null): void {
        this.clearHoverBoundsBoxInternal();
        if (!box) {
            return;
        }

        const helper = this.buildSelectionBoundsHelper(box, 0x00e5ff);
        if (!helper) {
            return;
        }

        const group = new THREE.Group();
        group.add(helper);
        group.renderOrder = 8;
        this.hoverBoundsGroup = group;
        this.scene.add(group);
        this.requestRender();
    }

    pickSelectableIdAtScreenPoint(x: number, y: number): string | null {
        return this.selectionManager?.pickObjectIdAtScreenPoint(x, y) ?? null;
    }

    registerSelectableObject(id: string, object: THREE.Object3D): void {
        this.selectionManager?.registerObject(id, object);
    }

    unregisterSelectableObject(id: string): void {
        this.selectionManager?.unregisterObject(id);
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
        const group = this.frameVisualizer.addFrame(data);
        if (!data.id.startsWith('__draft_')) {
            this.selectionManager?.registerObject(data.id, group);
        }
        this.syncFrameSelectionVisuals();
        this.requestRender();
        return group;
    }

    /**
     * 更新标架
     */
    updateFrame(data: FrameData): void {
        if (!data.id.startsWith('__draft_')) {
            this.selectionManager?.unregisterObject(data.id);
        }
        this.frameVisualizer.updateFrame(data);
        const group = this.frameVisualizer.getFrame(data.id);
        if (group && !data.id.startsWith('__draft_')) {
            this.selectionManager?.registerObject(data.id, group);
        }
        this.syncFrameSelectionVisuals();
        this.requestRender();
    }

    /**
     * 移除标架
     */
    removeFrame(id: string): void {
        if (!id.startsWith('__draft_')) {
            this.selectionManager?.unregisterObject(id);
        }
        this.frameVisualizer.removeFrame(id);
        this.syncFrameSelectionVisuals();
        this.requestRender();
    }

    /**
     * 设置标架可见性
     */
    setFrameVisible(id: string, visible: boolean): void {
        this.frameVisualizer.setFrameVisible(id, visible);
        this.requestRender();
    }

    /**
     * 设置所有标架可见性
     */
    setAllFramesVisible(visible: boolean): void {
        this.frameVisualizer.setAllFramesVisible(visible);
        this.requestRender();
    }

    // ========================================================================
    // 关节可视化 API
    // ========================================================================

    /**
     * 添加关节
     */
    addJoint(data: JointData): THREE.Group {
        const group = this.jointVisualizer.addJoint(data);
        this.selectionManager?.registerObject(data.id, group);
        this.syncJointSelectionVisuals();
        this.requestRender();
        return group;
    }

    /**
     * 更新关节
     */
    updateJoint(data: JointData): void {
        this.selectionManager?.unregisterObject(data.id);
        this.jointVisualizer.updateJoint(data);
        const group = this.jointVisualizer.getJoint(data.id);
        if (group) {
            this.selectionManager?.registerObject(data.id, group);
        }
        this.syncJointSelectionVisuals();
        this.requestRender();
    }

    /**
     * 移除关节
     */
    removeJoint(id: string): void {
        this.selectionManager?.unregisterObject(id);
        this.jointVisualizer.removeJoint(id);
        this.syncJointSelectionVisuals();
        this.requestRender();
    }

    /**
     * 设置关节可见性
     */
    setJointVisible(id: string, visible: boolean): void {
        this.jointVisualizer.setJointVisible(id, visible);
        this.requestRender();
    }

    /**
     * 设置所有关节可见性
     */
    setAllJointsVisible(visible: boolean): void {
        this.jointVisualizer.setAllJointsVisible(visible);
        this.requestRender();
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
    getRayFromScreenPoint(
        x: number,
        y: number
    ): {
        origin: { x: number; y: number; z: number };
        direction: { x: number; y: number; z: number };
    } | null {
        const rect = this.renderer.domElement.getBoundingClientRect();

        // 归一化设备坐标 (NDC): -1 到 +1
        const mouse = new THREE.Vector2(
            ((x - rect.left) / rect.width) * 2 - 1,
            -(((y - rect.top) / rect.height) * 2) + 1
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
