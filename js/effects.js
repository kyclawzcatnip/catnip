// ===== VISUAL EFFECTS =====

class EffectsManager {
    constructor() {
        this.particles = [];
        this.screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
        this.flash = { alpha: 0, color: '#fff', duration: 0 };
        this.hitSparks = [];
        this.texts = [];
    }

    update(dt) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 600 * dt; // gravity
            p.life -= dt;
            p.alpha = Math.max(0, p.life / p.maxLife);
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update hit sparks
        for (let i = this.hitSparks.length - 1; i >= 0; i--) {
            const s = this.hitSparks[i];
            s.life -= dt;
            s.alpha = Math.max(0, s.life / s.maxLife);
            s.radius += 200 * dt;
            if (s.life <= 0) this.hitSparks.splice(i, 1);
        }

        // Update floating texts
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.y -= 60 * dt;
            t.life -= dt;
            t.alpha = Math.max(0, t.life / t.maxLife);
            if (t.life <= 0) this.texts.splice(i, 1);
        }

        // Update screen shake
        if (this.screenShake.duration > 0) {
            this.screenShake.duration -= dt;
            const intensity = this.screenShake.intensity * (this.screenShake.duration / 0.3);
            this.screenShake.x = (Math.random() - 0.5) * intensity;
            this.screenShake.y = (Math.random() - 0.5) * intensity;
        } else {
            this.screenShake.x = 0;
            this.screenShake.y = 0;
        }

        // Update flash
        if (this.flash.duration > 0) {
            this.flash.duration -= dt;
            this.flash.alpha = Math.max(0, this.flash.duration / 0.15);
        }
    }

    draw(ctx) {
        // Draw particles
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw hit sparks
        for (const s of this.hitSparks) {
            ctx.save();
            ctx.globalAlpha = s.alpha * 0.6;
            const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
            gradient.addColorStop(0, s.color);
            gradient.addColorStop(0.5, s.color + '80');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw spark lines
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = s.alpha;
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i + s.rotation;
                const len = s.radius * 0.8;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x + Math.cos(angle) * len, s.y + Math.sin(angle) * len);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Draw floating texts
        for (const t of this.texts) {
            ctx.save();
            ctx.globalAlpha = t.alpha;
            ctx.font = `bold ${t.size}px Outfit`;
            ctx.fillStyle = t.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.textAlign = 'center';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }

        // Draw flash
        if (this.flash.alpha > 0) {
            ctx.save();
            ctx.globalAlpha = this.flash.alpha * 0.3;
            ctx.fillStyle = this.flash.color;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    }

    spawnHitParticles(x, y, color, count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 300;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100,
                size: 2 + Math.random() * 4,
                color: color,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.6,
                alpha: 1
            });
        }
    }

    spawnHitSpark(x, y, color) {
        this.hitSparks.push({
            x, y,
            radius: 5,
            color: color,
            life: 0.25,
            maxLife: 0.25,
            alpha: 1,
            rotation: Math.random() * Math.PI
        });
    }

    addFloatingText(x, y, text, color = '#fff', size = 24) {
        this.texts.push({
            x, y, text, color, size,
            life: 0.8, maxLife: 0.8, alpha: 1
        });
    }

    triggerScreenShake(intensity = 8) {
        this.screenShake.intensity = intensity;
        this.screenShake.duration = 0.2;
    }

    triggerFlash(color = '#fff') {
        this.flash.color = color;
        this.flash.duration = 0.15;
        this.flash.alpha = 1;
    }

    clear() {
        this.particles = [];
        this.hitSparks = [];
        this.texts = [];
        this.screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
        this.flash = { alpha: 0, color: '#fff', duration: 0 };
    }
}

const effects = new EffectsManager();
