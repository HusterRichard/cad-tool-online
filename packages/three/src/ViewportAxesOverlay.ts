import * as THREE from 'three';

export interface ViewportAxesOverlayOptions {
    viewportSize?: number;
    margin?: number;
    axisLength?: number;
    visible?: boolean;
}

export interface ViewportRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const DEFAULT_MARGIN = 12;
const DEFAULT_AXIS_LENGTH = 1.2;
const OVERLAY_CAMERA_FOV = 42;
const OVERLAY_CAMERA_NEAR = 0.1;
const OVERLAY_CAMERA_FAR = 16;
const OVERLAY_CAMERA_PADDING = 1.08;
const DEFAULT_VIEWPORT_SIZE = 128;
const LABEL_CANVAS_SIZE = 256;
const LABEL_FONT_SIZE = 150;
const LABEL_SCALE = 0.5;

export class ViewportAxesOverlay {
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly root: THREE.Group;
    private readonly viewportSize: number;
    private readonly margin: number;
    private visible: boolean;

    constructor(options: ViewportAxesOverlayOptions = {}) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            OVERLAY_CAMERA_FOV,
            1,
            OVERLAY_CAMERA_NEAR,
            OVERLAY_CAMERA_FAR
        );
        this.camera.position.set(0, 0, 6);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateProjectionMatrix();

        this.root = new THREE.Group();
        this.root.name = 'viewport_axes_overlay';
        this.scene.add(this.root);

        this.viewportSize = Math.max(1, Math.round(options.viewportSize ?? DEFAULT_VIEWPORT_SIZE));
        this.margin = Math.max(0, Math.round(options.margin ?? DEFAULT_MARGIN));
        this.visible = options.visible ?? true;

        this.buildTriad(options.axisLength ?? DEFAULT_AXIS_LENGTH);
    }

    getRoot(): THREE.Group {
        return this.root;
    }

    setVisible(visible: boolean): void {
        this.visible = visible;
    }

    isVisible(): boolean {
        return this.visible;
    }

    getViewportRect(containerWidth: number, containerHeight: number): ViewportRect {
        const availableWidth = Math.max(0, Math.floor(containerWidth) - this.margin * 2);
        const availableHeight = Math.max(0, Math.floor(containerHeight) - this.margin * 2);
        const size = Math.max(0, Math.min(this.viewportSize, availableWidth, availableHeight));
        return {
            x: this.margin,
            y: this.margin,
            width: size,
            height: size
        };
    }

    updateFromCamera(sourceCamera: THREE.Camera): void {
        const cameraQuaternion = new THREE.Quaternion();
        sourceCamera.getWorldQuaternion(cameraQuaternion);
        this.root.quaternion.copy(cameraQuaternion).invert();
        this.root.updateMatrixWorld(true);
    }

    render(
        renderer: THREE.WebGLRenderer,
        sourceCamera: THREE.Camera,
        containerWidth: number,
        containerHeight: number
    ): void {
        if (!this.visible) {
            return;
        }

        const viewport = this.getViewportRect(containerWidth, containerHeight);
        if (viewport.width <= 0 || viewport.height <= 0) {
            return;
        }

        this.updateFromCamera(sourceCamera);

        const previousViewport = new THREE.Vector4();
        const previousScissor = new THREE.Vector4();
        const previousScissorTest = renderer.getScissorTest();
        const previousAutoClear = renderer.autoClear;
        renderer.getViewport(previousViewport);
        renderer.getScissor(previousScissor);

        renderer.clearDepth();
        renderer.autoClear = false;
        renderer.setScissorTest(true);
        renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
        renderer.setScissor(viewport.x, viewport.y, viewport.width, viewport.height);
        renderer.render(this.scene, this.camera);

        renderer.setViewport(
            previousViewport.x,
            previousViewport.y,
            previousViewport.z,
            previousViewport.w
        );
        renderer.setScissor(
            previousScissor.x,
            previousScissor.y,
            previousScissor.z,
            previousScissor.w
        );
        renderer.setScissorTest(previousScissorTest);
        renderer.autoClear = previousAutoClear;
    }

    dispose(): void {
        this.root.traverse(child => {
            const geometry = (child as THREE.Mesh).geometry;
            if (geometry instanceof THREE.BufferGeometry) {
                geometry.dispose();
            }

            const material = (child as THREE.Mesh).material;
            if (Array.isArray(material)) {
                material.forEach(item => item.dispose());
            } else if (material instanceof THREE.Material) {
                material.dispose();
            }
        });
    }

    private buildTriad(axisLength: number): void {
        const arrowHeadLength = axisLength * 0.24;
        const labelOffset = axisLength + arrowHeadLength * 0.9;
        this.root.add(this.createAxisArrow(new THREE.Vector3(1, 0, 0), 0xff4d4f, axisLength));
        this.root.add(this.createAxisArrow(new THREE.Vector3(0, 1, 0), 0x52c41a, axisLength));
        this.root.add(this.createAxisArrow(new THREE.Vector3(0, 0, 1), 0x1677ff, axisLength));

        const xLabel = this.createAxisLabel('x', 0xff4d4f);
        xLabel.position.set(labelOffset, 0, 0);
        this.root.add(xLabel);

        const yLabel = this.createAxisLabel('y', 0x52c41a);
        yLabel.position.set(0, labelOffset, 0);
        this.root.add(yLabel);

        const zLabel = this.createAxisLabel('z', 0x1677ff);
        zLabel.position.set(0, 0, labelOffset);
        this.root.add(zLabel);

        const origin = new THREE.Mesh(
            new THREE.SphereGeometry(axisLength * 0.045, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
        );
        origin.name = 'viewport_axes_origin';
        this.root.add(origin);

        this.fitCameraToContent(labelOffset);
    }

    private createAxisArrow(
        direction: THREE.Vector3,
        color: number,
        axisLength: number
    ): THREE.ArrowHelper {
        const arrowHeadLength = axisLength * 0.24;
        const arrowHeadWidth = axisLength * 0.12;
        const arrow = new THREE.ArrowHelper(
            direction,
            new THREE.Vector3(0, 0, 0),
            axisLength,
            color,
            arrowHeadLength,
            arrowHeadWidth
        );
        arrow.name = `viewport_axis_${direction.toArray().join('_')}`;
        arrow.line.material = new THREE.LineBasicMaterial({
            color,
            toneMapped: false
        });
        arrow.cone.material = new THREE.MeshBasicMaterial({
            color,
            toneMapped: false
        });
        return arrow;
    }

    private createAxisLabel(letter: 'x' | 'y' | 'z', color: number): THREE.Sprite {
        const label = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: this.createLabelTexture(letter.toUpperCase(), color),
                transparent: true,
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            })
        );
        label.scale.setScalar(LABEL_SCALE);
        label.name = `viewport_axis_label_${letter}`;
        return label;
    }

    private createLabelTexture(letter: string, color: number): THREE.Texture | null {
        const canvas = this.createLabelCanvas();
        if (!canvas) {
            return null;
        }

        const context = canvas.getContext('2d');
        if (!context) {
            return null;
        }

        context.clearRect(0, 0, LABEL_CANVAS_SIZE, LABEL_CANVAS_SIZE);
        context.font = `700 ${LABEL_FONT_SIZE}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = `#${new THREE.Color(color).getHexString()}`;
        context.fillText(letter, LABEL_CANVAS_SIZE / 2, LABEL_CANVAS_SIZE / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    private createLabelCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const canvas = document.createElement('canvas');
            canvas.width = LABEL_CANVAS_SIZE;
            canvas.height = LABEL_CANVAS_SIZE;
            return canvas;
        }

        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(LABEL_CANVAS_SIZE, LABEL_CANVAS_SIZE);
        }

        return null;
    }

    private fitCameraToContent(labelOffset: number): void {
        const labelHalfDiagonal = (LABEL_SCALE * Math.SQRT2) / 2;
        const contentRadius = labelOffset + labelHalfDiagonal;
        const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
        const requiredDistance =
            (contentRadius / Math.sin(halfFov)) * OVERLAY_CAMERA_PADDING;

        this.camera.position.set(0, 0, requiredDistance);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateMatrixWorld(true);
        this.camera.updateProjectionMatrix();
    }
}
