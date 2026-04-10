export class RenderFrameBudget {
    private pendingFrames: number;

    constructor(initialFrames: number = 1) {
        this.pendingFrames = Math.max(0, Math.floor(initialFrames));
    }

    schedule(frameCount: number = 1): void {
        const normalized = Math.max(0, Math.floor(frameCount));
        if (normalized === 0) {
            return;
        }

        this.pendingFrames = Math.max(this.pendingFrames, normalized);
    }

    consume(): boolean {
        if (this.pendingFrames <= 0) {
            return false;
        }

        this.pendingFrames -= 1;
        return true;
    }
}
