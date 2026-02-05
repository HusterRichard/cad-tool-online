import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MeshData } from '@cadtool-online/core';

export interface ThreeViewerOptions {
    backgroundColor?: number;
    antialias?: boolean;
}

export class ThreeViewer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private container: HTMLElement;
    private meshes: Map<string, THREE.Mesh> = new Map();

    constructor(container: HTMLElement, options: ThreeViewerOptions = {}) {
        this.container = container;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(options.backgroundColor ?? 0x2a2a2a);

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
        this.camera.position.set(100, 100, 100);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: options.antialias ?? true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.setupLights();
        this.setupGrid();
        this.animate();

        // Handle resize
        window.addEventListener('resize', this.onResize.bind(this));
    }

    private setupLights(): void {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 100);
        this.scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-100, -100, -100);
        this.scene.add(directionalLight2);
    }

    private setupGrid(): void {
        const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x333333);
        gridHelper.rotation.x = Math.PI / 2; // Z-up
        this.scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(50);
        this.scene.add(axesHelper);
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    private onResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    addMeshFromData(id: string, meshData: MeshData, material?: THREE.Material): THREE.Mesh {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
        geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

        const mat = material ?? new THREE.MeshPhongMaterial({
            color: 0x808080,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, mat);
        this.scene.add(mesh);
        this.meshes.set(id, mesh);

        return mesh;
    }

    removeMesh(id: string): void {
        const mesh = this.meshes.get(id);
        if (mesh) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
            this.meshes.delete(id);
        }
    }

    getMesh(id: string): THREE.Mesh | undefined {
        return this.meshes.get(id);
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

    dispose(): void {
        window.removeEventListener('resize', this.onResize.bind(this));
        this.meshes.forEach((_mesh, id) => this.removeMesh(id));
        this.renderer.dispose();
        this.controls.dispose();
    }
}
