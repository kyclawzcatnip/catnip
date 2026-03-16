// ===== GAME ENGINE =====

class Engine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 960;
        this.canvas.height = 540;

        this.keys = {};
        this.lastTime = 0;
        this.running = false;
        this.updateFn = null;
        this.drawFn = null;

        this.setupInput();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            e.preventDefault();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            e.preventDefault();
        });
    }

    start(updateFn, drawFn) {
        this.updateFn = updateFn;
        this.drawFn = drawFn;
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        if (!this.running) return;

        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // Cap at 50ms
        this.lastTime = timestamp;

        // Clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply screen shake
        this.ctx.save();
        this.ctx.translate(effects.screenShake.x, effects.screenShake.y);

        if (this.updateFn) this.updateFn(dt);
        if (this.drawFn) this.drawFn(this.ctx);

        this.ctx.restore();

        requestAnimationFrame((t) => this.loop(t));
    }
}
