// ===== FIGHTER CLASS =====

const GROUND_Y = 420;
const GRAVITY = 1800;
const MOVE_SPEED = 280;
const JUMP_FORCE = -650;

const FIGHTER_WIDTH = 60;
const FIGHTER_HEIGHT = 80;

const STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    JUMP: 'jump',
    PUNCH: 'punch',
    KICK: 'kick',
    BLOCK: 'block',
    HURT: 'hurt',
    KO: 'ko'
};

const ATTACK_DATA = {
    punch: { damage: 8, range: 70, startup: 0.05, active: 0.1, recovery: 0.2, knockback: 150, hitstun: 0.25 },
    kick: { damage: 14, range: 80, startup: 0.1, active: 0.12, recovery: 0.35, knockback: 250, hitstun: 0.35 }
};

class Fighter {
    constructor(x, facingRight, colorScheme, name) {
        this.name = name;
        this.x = x;
        this.y = GROUND_Y;
        this.vx = 0;
        this.vy = 0;
        this.width = FIGHTER_WIDTH;
        this.height = FIGHTER_HEIGHT;
        this.facingRight = facingRight;
        this.colors = colorScheme;

        // State
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        this.attackPhase = ''; // startup, active, recovery
        this.attackType = '';
        this.hasHit = false;

        // Health
        this.health = 100;
        this.maxHealth = 100;
        this.displayHealth = 100;

        // Combo
        this.comboCount = 0;
        this.comboTimer = 0;

        // Animation
        this.animFrame = 0;
        this.animTimer = 0;
        this.hurtTimer = 0;

        // Round wins
        this.wins = 0;

        // Grounded
        this.grounded = true;

        // Power-up buffs
        this.regenTimer = 0;       // seconds remaining
        this.regenTotal = 0;       // HP healed so far this regen
        this.shieldBuff = false;   // 3x block effectiveness
        this.shieldTimer = 0;      // seconds remaining
    }

    reset(x, facingRight) {
        this.x = x;
        this.y = GROUND_Y;
        this.vx = 0;
        this.vy = 0;
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        this.attackPhase = '';
        this.attackType = '';
        this.hasHit = false;
        this.health = 100;
        this.displayHealth = 100;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.hurtTimer = 0;
        this.facingRight = facingRight;
        this.grounded = true;

        // Reset buffs
        this.regenTimer = 0;
        this.regenTotal = 0;
        this.shieldBuff = false;
        this.shieldTimer = 0;
    }

    get centerX() { return this.x; }
    get centerY() { return this.y - this.height / 2; }

    get hitbox() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height,
            w: this.width,
            h: this.height
        };
    }

    get attackHitbox() {
        if (this.state !== STATES.PUNCH && this.state !== STATES.KICK) return null;
        if (this.attackPhase !== 'active') return null;

        const data = ATTACK_DATA[this.attackType];
        const dir = this.facingRight ? 1 : -1;
        return {
            x: this.x + (this.facingRight ? this.width / 2 - 10 : -this.width / 2 - data.range + 10),
            y: this.y - this.height + (this.attackType === 'kick' ? 30 : 15),
            w: data.range,
            h: this.attackType === 'kick' ? 30 : 25
        };
    }

    canAct() {
        return this.state === STATES.IDLE || this.state === STATES.WALK || this.state === STATES.JUMP;
    }

    startAttack(type) {
        if (!this.canAct() || this.state === STATES.KO) return;
        this.state = type === 'punch' ? STATES.PUNCH : STATES.KICK;
        this.attackType = type;
        this.attackPhase = 'startup';
        this.stateTimer = 0;
        this.hasHit = false;
    }

    startBlock() {
        if (!this.canAct() || !this.grounded || this.state === STATES.KO) return;
        this.state = STATES.BLOCK;
        this.vx = 0;
    }

    stopBlock() {
        if (this.state === STATES.BLOCK) {
            this.state = STATES.IDLE;
        }
    }

    jump() {
        if (this.grounded && this.canAct() && this.state !== STATES.KO) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
            this.state = STATES.JUMP;
        }
    }

    takeHit(damage, knockbackDir, knockbackForce) {
        if (this.state === STATES.KO) return;

        let actualDamage = damage;
        let blocked = false;

        if (this.state === STATES.BLOCK) {
            const blockMult = this.shieldBuff ? 0.08 : 0.25;
            actualDamage = Math.floor(damage * blockMult);
            knockbackForce *= this.shieldBuff ? 0.15 : 0.3;
            blocked = true;
            audio.playBlock();
        }

        this.health = Math.max(0, this.health - actualDamage);
        this.vx = knockbackDir * knockbackForce;

        if (!blocked) {
            this.state = STATES.HURT;
            this.stateTimer = 0;
            this.hurtTimer = ATTACK_DATA[this.attackType === 'kick' ? 'kick' : 'punch'].hitstun;
        }

        if (this.health <= 0) {
            this.state = STATES.KO;
            this.vy = -300;
            this.grounded = false;
        }

        return { blocked, actualDamage };
    }

    update(dt, opponent) {
        // Animation timer
        this.animTimer += dt;
        if (this.animTimer > 0.12) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
            }
        }

        // Display health smooth
        if (this.displayHealth > this.health) {
            this.displayHealth -= (this.displayHealth - this.health) * 8 * dt;
            if (this.displayHealth - this.health < 0.5) this.displayHealth = this.health;
        }
        if (this.displayHealth < this.health) {
            this.displayHealth += (this.health - this.displayHealth) * 8 * dt;
            if (this.health - this.displayHealth < 0.5) this.displayHealth = this.health;
        }

        // Regen buff tick
        if (this.regenTimer > 0 && this.state !== STATES.KO) {
            this.regenTimer -= dt;
            const healThisTick = (10 / 3) * dt; // 10 HP over 3s
            const maxHeal = 10 - this.regenTotal;
            const heal = Math.min(healThisTick, maxHeal);
            if (heal > 0) {
                this.health = Math.min(this.maxHealth, this.health + heal);
                this.regenTotal += heal;
            }
            if (this.regenTimer <= 0) {
                this.regenTimer = 0;
            }
        }

        // Shield buff timer
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shieldBuff = false;
                this.shieldTimer = 0;
            }
        }

        // Attack state machine
        if (this.state === STATES.PUNCH || this.state === STATES.KICK) {
            this.stateTimer += dt;
            const data = ATTACK_DATA[this.attackType];

            if (this.attackPhase === 'startup' && this.stateTimer >= data.startup) {
                this.attackPhase = 'active';
                this.stateTimer = 0;
            } else if (this.attackPhase === 'active' && this.stateTimer >= data.active) {
                this.attackPhase = 'recovery';
                this.stateTimer = 0;
            } else if (this.attackPhase === 'recovery' && this.stateTimer >= data.recovery) {
                this.state = this.grounded ? STATES.IDLE : STATES.JUMP;
                this.attackPhase = '';
            }
        }

        // Hurt state
        if (this.state === STATES.HURT) {
            this.hurtTimer -= dt;
            if (this.hurtTimer <= 0) {
                this.state = this.grounded ? STATES.IDLE : STATES.JUMP;
            }
        }

        // Physics
        if (!this.grounded) {
            this.vy += GRAVITY * dt;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Friction
        if (this.grounded && this.state !== STATES.WALK) {
            this.vx *= (1 - 12 * dt);
        }

        // Ground collision
        if (this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.vy = 0;
            if (!this.grounded) {
                this.grounded = true;
                if (this.state === STATES.JUMP) {
                    this.state = STATES.IDLE;
                }
                if (this.state === STATES.KO) {
                    this.vx = 0;
                }
            }
        }

        // Stage bounds
        if (this.x < 40) this.x = 40;
        if (this.x > 920) this.x = 920;

        // Face opponent
        if (this.canAct() && opponent && this.state !== STATES.BLOCK) {
            this.facingRight = opponent.x > this.x;
        }
    }

    draw(ctx) {
        ctx.save();
        const drawX = this.x;
        const drawY = this.y;

        // Cat body position with animation
        const bobY = this.state === STATES.IDLE ? Math.sin(this.animTimer * 8 + this.animFrame) * 2 : 0;
        const baseY = drawY - this.height + bobY;

        // Hurt flash
        if (this.state === STATES.HURT && Math.floor(this.hurtTimer * 20) % 2) {
            ctx.globalAlpha = 0.6;
        }

        // KO tilt
        if (this.state === STATES.KO && this.grounded) {
            ctx.translate(drawX, drawY);
            ctx.rotate((this.facingRight ? 1 : -1) * Math.PI / 3);
            ctx.translate(-drawX, -drawY);
        }

        const dir = this.facingRight ? 1 : -1;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(drawX, GROUND_Y + 2, 25, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // === DRAW CAT ===

        // Tail
        ctx.save();
        ctx.strokeStyle = this.colors.body;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const tailWag = Math.sin(this.animTimer * 15 + this.animFrame * 2) * 15;
        const tailX = drawX - dir * 20;
        ctx.moveTo(tailX, baseY + 55);
        ctx.quadraticCurveTo(tailX - dir * 25, baseY + 30 + tailWag, tailX - dir * 35, baseY + 20 + tailWag);
        ctx.stroke();
        ctx.restore();

        // Body
        ctx.fillStyle = this.colors.body;
        ctx.beginPath();
        ctx.ellipse(drawX, baseY + 50, 22, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        const walkOffset = this.state === STATES.WALK ? Math.sin(this.animTimer * 20) * 8 : 0;
        const kickExtend = (this.state === STATES.KICK && this.attackPhase === 'active') ? 20 : 0;

        // Back legs
        ctx.fillStyle = this.colors.bodyDark;
        ctx.fillRect(drawX - 12, baseY + 58, 8, 18 - walkOffset);
        ctx.fillRect(drawX + 4, baseY + 58, 8, 18 + walkOffset);

        // Front kick leg extension
        if (kickExtend > 0) {
            ctx.fillStyle = this.colors.body;
            ctx.save();
            ctx.translate(drawX + dir * 12, baseY + 60);
            ctx.rotate(dir * -0.5);
            ctx.fillRect(0, -4, dir * (20 + kickExtend), 8);
            // Paw
            ctx.fillStyle = this.colors.paw;
            ctx.beginPath();
            ctx.arc(dir * (20 + kickExtend), 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Paws
        ctx.fillStyle = this.colors.paw;
        ctx.beginPath();
        ctx.ellipse(drawX - 10, baseY + 76 - walkOffset, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(drawX + 10, baseY + 76 + walkOffset, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = this.colors.body;
        ctx.beginPath();
        ctx.arc(drawX + dir * 8, baseY + 28, 20, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        const headX = drawX + dir * 8;
        const headY = baseY + 28;
        ctx.fillStyle = this.colors.body;
        // Left ear
        ctx.beginPath();
        ctx.moveTo(headX - 14, headY - 12);
        ctx.lineTo(headX - 8, headY - 28);
        ctx.lineTo(headX - 2, headY - 12);
        ctx.fill();
        // Right ear
        ctx.beginPath();
        ctx.moveTo(headX + 2, headY - 12);
        ctx.lineTo(headX + 8, headY - 28);
        ctx.lineTo(headX + 14, headY - 12);
        ctx.fill();

        // Inner ears
        ctx.fillStyle = this.colors.innerEar;
        ctx.beginPath();
        ctx.moveTo(headX - 12, headY - 13);
        ctx.lineTo(headX - 8, headY - 24);
        ctx.lineTo(headX - 4, headY - 13);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(headX + 4, headY - 13);
        ctx.lineTo(headX + 8, headY - 24);
        ctx.lineTo(headX + 12, headY - 13);
        ctx.fill();

        // Face
        // Eyes
        const eyeOpenness = this.state === STATES.KO ? 0.3 : (this.state === STATES.HURT ? 0.5 : 1.0);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(headX - 6, headY - 2, 5, 5 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(headX + 6, headY - 2, 5, 5 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = this.colors.eyes;
        const pupilDir = this.facingRight ? 1.5 : -1.5;
        ctx.beginPath();
        ctx.ellipse(headX - 6 + pupilDir, headY - 2, 2.5, 3.5 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(headX + 6 + pupilDir, headY - 2, 2.5, 3.5 * eyeOpenness, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = this.colors.nose;
        ctx.beginPath();
        ctx.moveTo(headX, headY + 4);
        ctx.lineTo(headX - 3, headY + 7);
        ctx.lineTo(headX + 3, headY + 7);
        ctx.fill();

        // Mouth
        ctx.strokeStyle = this.colors.bodyDark;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(headX, headY + 7);
        ctx.lineTo(headX - 4, headY + 11);
        ctx.moveTo(headX, headY + 7);
        ctx.lineTo(headX + 4, headY + 11);
        ctx.stroke();

        // Whiskers
        ctx.strokeStyle = this.colors.bodyDark;
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i += 2) {
            for (let w = -1; w <= 1; w++) {
                ctx.beginPath();
                ctx.moveTo(headX + i * 10, headY + 6 + w * 3);
                ctx.lineTo(headX + i * 25, headY + 4 + w * 5);
                ctx.stroke();
            }
        }

        // Chest/belly pattern
        ctx.fillStyle = this.colors.belly;
        ctx.beginPath();
        ctx.ellipse(drawX, baseY + 52, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Punch arm
        if (this.state === STATES.PUNCH && this.attackPhase === 'active') {
            ctx.fillStyle = this.colors.body;
            ctx.save();
            ctx.translate(drawX + dir * 15, baseY + 40);
            ctx.fillRect(0, -4, dir * 35, 8);
            // Boxing paw
            ctx.fillStyle = this.colors.paw;
            ctx.beginPath();
            ctx.arc(dir * 38, 0, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Block shield
        if (this.state === STATES.BLOCK) {
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.6 + Math.sin(this.animTimer * 15) * 0.2;
            ctx.beginPath();
            ctx.arc(drawX + dir * 15, baseY + 40, 28, -Math.PI * 0.6, Math.PI * 0.6);
            ctx.stroke();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#67e8f9';
            ctx.beginPath();
            ctx.arc(drawX + dir * 15, baseY + 40, 28, -Math.PI * 0.6, Math.PI * 0.6);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // KO stars
        if (this.state === STATES.KO) {
            ctx.fillStyle = '#fbbf24';
            ctx.font = '16px Outfit';
            for (let i = 0; i < 3; i++) {
                const starAngle = this.animTimer * 3 + (Math.PI * 2 / 3) * i;
                const starX = headX + Math.cos(starAngle) * 22;
                const starY = headY - 18 + Math.sin(starAngle) * 8;
                ctx.fillText('✦', starX - 5, starY);
            }
        }

        ctx.restore();
    }
}

// Cat color schemes
const CAT_COLORS = {
    orange: {
        body: '#f59e0b',
        bodyDark: '#d97706',
        belly: '#fef3c7',
        paw: '#fde68a',
        innerEar: '#fca5a5',
        eyes: '#065f46',
        nose: '#f472b6',
        name: 'Ginger'
    },
    gray: {
        body: '#6b7280',
        bodyDark: '#4b5563',
        belly: '#e5e7eb',
        paw: '#d1d5db',
        innerEar: '#fca5a5',
        eyes: '#1e40af',
        nose: '#f472b6',
        name: 'Shadow'
    },
    black: {
        body: '#374151',
        bodyDark: '#1f2937',
        belly: '#6b7280',
        paw: '#9ca3af',
        innerEar: '#fb923c',
        eyes: '#eab308',
        nose: '#d1d5db',
        name: 'Midnight'
    },
    white: {
        body: '#e5e7eb',
        bodyDark: '#d1d5db',
        belly: '#f9fafb',
        paw: '#fce7f3',
        innerEar: '#fca5a5',
        eyes: '#7c3aed',
        nose: '#f9a8d4',
        name: 'Snow'
    }
};

function checkHit(attacker, defender) {
    const atkBox = attacker.attackHitbox;
    if (!atkBox) return false;

    const defBox = defender.hitbox;
    return atkBox.x < defBox.x + defBox.w &&
        atkBox.x + atkBox.w > defBox.x &&
        atkBox.y < defBox.y + defBox.h &&
        atkBox.y + atkBox.h > defBox.y;
}
