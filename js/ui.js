// ===== UI DRAWING =====

class GameUI {
    constructor() {
        this.roundText = '';
        this.roundTextTimer = 0;
        this.roundTextAlpha = 0;
        this.showRoundText = false;
    }

    drawHUD(ctx, fighter1, fighter2, timer, round) {
        const W = ctx.canvas.width;

        // Health bar background panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(20, 15, W - 40, 50, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Player 1 health bar (left side)
        this.drawHealthBar(ctx, 30, 22, 360, 20, fighter1, false);

        // Player 2 health bar (right side)
        this.drawHealthBar(ctx, W - 390, 22, 360, 20, fighter2, true);

        // Player names
        ctx.font = 'bold 13px Outfit';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'left';
        ctx.fillText(fighter1.name, 32, 55);

        ctx.fillStyle = '#8b5cf6';
        ctx.textAlign = 'right';
        ctx.fillText(fighter2.name, W - 32, 55);

        // Timer
        ctx.textAlign = 'center';
        ctx.font = 'bold 28px Outfit';
        const timerSec = Math.ceil(timer);
        ctx.fillStyle = timerSec <= 10 ? '#ef4444' : '#fff';
        ctx.fillText(timerSec.toString(), W / 2, 48);

        // Round indicators
        ctx.font = '12px Outfit';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`ROUND ${round}`, W / 2, 25);

        // Win dots
        this.drawWinDots(ctx, W / 2 - 50, 55, fighter1.wins);
        this.drawWinDots(ctx, W / 2 + 30, 55, fighter2.wins);
    }

    drawHealthBar(ctx, x, y, w, h, fighter, reversed) {
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();

        // Damage flash (yellow bar behind main bar)
        const displayRatio = fighter.displayHealth / fighter.maxHealth;
        const healthRatio = fighter.health / fighter.maxHealth;

        if (displayRatio > healthRatio) {
            ctx.fillStyle = '#fbbf24';
            if (reversed) {
                const barW = displayRatio * (w - 4);
                ctx.beginPath();
                ctx.roundRect(x + w - 2 - barW, y + 2, barW, h - 4, 3);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.roundRect(x + 2, y + 2, displayRatio * (w - 4), h - 4, 3);
                ctx.fill();
            }
        }

        // Main health bar
        let barColor;
        if (healthRatio > 0.6) barColor = '#22c55e';
        else if (healthRatio > 0.3) barColor = '#f59e0b';
        else barColor = '#ef4444';

        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, barColor);
        gradient.addColorStop(1, barColor + 'aa');

        ctx.fillStyle = gradient;
        if (reversed) {
            const barW = healthRatio * (w - 4);
            ctx.beginPath();
            ctx.roundRect(x + w - 2 - barW, y + 2, barW, h - 4, 3);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, healthRatio * (w - 4), h - 4, 3);
            ctx.fill();
        }

        // Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h / 2 - 2, [3, 3, 0, 0]);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.stroke();

        // Health text
        ctx.font = 'bold 11px Outfit';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(fighter.health)}`, x + w / 2, y + h / 2 + 4);
    }

    drawWinDots(ctx, x, y, wins) {
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(x + i * 18, y, 5, 0, Math.PI * 2);
            if (i < wins) {
                ctx.fillStyle = '#fbbf24';
                ctx.fill();
                // Glow
                ctx.shadowColor = '#fbbf24';
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fill();
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    showRoundAnnouncement(text) {
        this.roundText = text;
        this.roundTextTimer = 2.0;
        this.showRoundText = true;
        this.roundTextAlpha = 1;
    }

    updateAnnouncement(dt) {
        if (this.showRoundText) {
            this.roundTextTimer -= dt;
            if (this.roundTextTimer < 0.5) {
                this.roundTextAlpha = Math.max(0, this.roundTextTimer / 0.5);
            }
            if (this.roundTextTimer <= 0) {
                this.showRoundText = false;
            }
        }
    }

    drawAnnouncement(ctx) {
        if (!this.showRoundText) return;

        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        ctx.save();
        ctx.globalAlpha = this.roundTextAlpha;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, H / 2 - 50, W, 100);

        // Text
        ctx.font = 'bold 48px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text glow
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#fff';
        ctx.fillText(this.roundText, W / 2, H / 2);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    drawBackground(ctx, time) {
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(0.4, '#1e1b4b');
        skyGrad.addColorStop(0.7, '#312e81');
        skyGrad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // Stars
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        const starSeed = 42;
        for (let i = 0; i < 40; i++) {
            const sx = ((i * 137 + starSeed) % W);
            const sy = ((i * 97 + starSeed * 2) % (GROUND_Y - 30));
            const twink = Math.sin(time * 2 + i) * 0.5 + 0.5;
            ctx.globalAlpha = 0.3 + twink * 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy, 1 + twink, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Moon
        ctx.fillStyle = '#e2e8f0';
        ctx.shadowColor = '#e2e8f0';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(780, 80, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Moon craters
        ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.beginPath(); ctx.arc(770, 70, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(790, 85, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(775, 90, 4, 0, Math.PI * 2); ctx.fill();

        // Ground
        const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
        groundGrad.addColorStop(0, '#374151');
        groundGrad.addColorStop(0.3, '#1f2937');
        groundGrad.addColorStop(1, '#111827');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

        // Ground line
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(W, GROUND_Y);
        ctx.stroke();

        // Ground glow
        const glowGrad = ctx.createLinearGradient(0, GROUND_Y - 5, 0, GROUND_Y + 10);
        glowGrad.addColorStop(0, 'transparent');
        glowGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.15)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, GROUND_Y - 5, W, 15);

        // Arena boundary markers
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(40, GROUND_Y + 5);
        ctx.lineTo(40, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(920, GROUND_Y + 5);
        ctx.lineTo(920, H);
        ctx.stroke();
        ctx.setLineDash([]);

        // City silhouette in background
        ctx.fillStyle = 'rgba(30, 27, 75, 0.8)';
        const buildings = [
            { x: 50, w: 60, h: 100 },
            { x: 120, w: 40, h: 140 },
            { x: 170, w: 55, h: 80 },
            { x: 240, w: 35, h: 160 },
            { x: 285, w: 50, h: 110 },
            { x: 350, w: 45, h: 130 },
            { x: 450, w: 60, h: 90 },
            { x: 520, w: 30, h: 170 },
            { x: 560, w: 55, h: 100 },
            { x: 650, w: 40, h: 150 },
            { x: 700, w: 50, h: 120 },
            { x: 760, w: 35, h: 95 },
            { x: 830, w: 60, h: 140 },
            { x: 900, w: 40, h: 110 }
        ];
        for (const b of buildings) {
            ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
            // Windows
            ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
            for (let wy = GROUND_Y - b.h + 15; wy < GROUND_Y - 10; wy += 18) {
                for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14) {
                    if (Math.random() > 0.4) {
                        ctx.fillRect(wx, wy, 6, 8);
                    }
                }
            }
            ctx.fillStyle = 'rgba(30, 27, 75, 0.8)';
        }
    }
}

const gameUI = new GameUI();
