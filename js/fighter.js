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

        // New Arcade mode buffs
        this.speedFishTimer = 0;
        this.giantPawTimer = 0;
        this.doubleJumpBuff = false;
        this.laserYarnTimer = 0;
        this.jumpCount = 0;
        this.scale = 1;
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
        this.speedFishTimer = 0;
        this.giantPawTimer = 0;
        this.doubleJumpBuff = false;
        this.laserYarnTimer = 0;
        this.jumpCount = 0;
        this.scale = 1;
    }

    get centerX() { return this.x; }
    get centerY() { return this.y - this.height / 2; }

    get hitbox() {
        const w = this.width * (this.scale || 1);
        const h = this.height * (this.scale || 1);
        return {
            x: this.x - w / 2,
            y: this.y - h,
            w: w,
            h: h
        };
    }

    get attackHitbox() {
        if (this.state !== STATES.PUNCH && this.state !== STATES.KICK) return null;
        if (this.attackPhase !== 'active') return null;

        const data = ATTACK_DATA[this.attackType];
        const scale = this.scale || 1;
        const range = data.range * scale;
        const w = this.width * scale;
        const h = this.height * scale;
        return {
            x: this.x + (this.facingRight ? w / 2 - 10 : -w / 2 - range + 10),
            y: this.y - h + (this.attackType === 'kick' ? 30 * scale : 15 * scale),
            w: range,
            h: this.attackType === 'kick' ? 30 * scale : 25 * scale
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

        if (typeof incrementQuestProgress === 'function') {
            incrementQuestProgress('smash_attacks');
        }
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
        if (this.state === STATES.KO) return;
        if (this.grounded && this.canAct()) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
            this.state = STATES.JUMP;
            this.jumpCount = 1;
            
            if (typeof incrementQuestProgress === 'function') {
                incrementQuestProgress('smash_jumps');
            }
        } else if (this.doubleJumpBuff && this.jumpCount === 1 && this.canAct()) {
            this.vy = JUMP_FORCE * 0.9;
            this.state = STATES.JUMP;
            this.jumpCount = 2;
            if (effects && effects.spawnHitParticles) {
                effects.spawnHitParticles(this.x, this.y - 10, '#d946ef', 6);
            }
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

        // Speed fish buff timer
        if (this.speedFishTimer > 0) {
            this.speedFishTimer -= dt;
            if (this.speedFishTimer <= 0) {
                this.speedFishTimer = 0;
            }
        }

        // Giant paw buff timer
        if (this.giantPawTimer > 0) {
            this.giantPawTimer -= dt;
            if (this.giantPawTimer <= 0) {
                this.giantPawTimer = 0;
                this.scale = 1;
            }
        }

        // Laser yarn buff timer
        if (this.laserYarnTimer > 0) {
            this.laserYarnTimer -= dt;
            if (this.laserYarnTimer <= 0) {
                this.laserYarnTimer = 0;
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
                this.jumpCount = 0;
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
        
        // Apply scaling
        if (this.scale && this.scale !== 1) {
            ctx.translate(this.x, this.y);
            ctx.scale(this.scale, this.scale);
            ctx.translate(-this.x, -this.y);
        }

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

// ===== ENEMY RAT CLASS =====
class EnemyRat {
    constructor(x, y, type, isBoss = false) {
        this.type = type; // 'wizard', 'robot', 'ninja', 'giant', 'ghost', 'king', 'robo_boss', 'hunter'
        this.isBoss = isBoss;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = type === 'giant' ? 100 : (isBoss ? 110 : 50);
        this.height = type === 'giant' ? 110 : (isBoss ? 120 : 65);
        this.health = type === 'giant' ? 200 : (isBoss ? (type === 'king' ? 400 : (type === 'robo_boss' ? 500 : 450)) : 50);
        if (type === 'robot') this.health = 80;
        if (type === 'ninja') this.health = 40;
        this.maxHealth = this.health;
        this.displayHealth = this.health;
        this.facingRight = true;
        this.state = 'idle'; // 'idle', 'walk', 'attack', 'hurt', 'ko'
        this.stateTimer = 0;
        this.attackPhase = '';
        this.animTimer = 0;
        this.animFrame = 0;
        this.grounded = true;
        this.speed = type === 'ninja' ? 190 : (type === 'giant' ? 110 : (type === 'robot' ? 90 : (isBoss ? 130 : 140)));
        this.attackCooldown = 0;
        this.shootTimer = 0;
        this.hurtTimer = 0;
        this.ghostFloat = 0; // for float movement of ghost rats
    }

    get hitbox() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height,
            w: this.width,
            h: this.height
        };
    }

    takeHit(damage, knockbackDir, knockbackForce) {
        if (this.state === 'ko') return;
        this.health = Math.max(0, this.health - damage);
        this.vx = knockbackDir * knockbackForce * (this.type === 'giant' || this.isBoss ? 0.3 : 1.0);
        this.state = 'hurt';
        this.stateTimer = 0;
        this.hurtTimer = 0.2;
        if (this.health <= 0) {
            this.state = 'ko';
            this.vy = -250;
            this.grounded = false;

            if (typeof incrementQuestProgress === 'function') {
                incrementQuestProgress('smash_rats');
                
                // Beat Rat King quest
                if (this.type === 'king') {
                    incrementQuestProgress('smash_boss');
                }
                
                // Beat all bosses quest
                if (this.isBoss) {
                    try {
                        let beaten = JSON.parse(localStorage.getItem('scw_beaten_bosses') || '[]');
                        if (!beaten.includes(this.type)) {
                            beaten.push(this.type);
                            localStorage.setItem('scw_beaten_bosses', JSON.stringify(beaten));
                        }
                        if (beaten.includes('king') && beaten.includes('robo_boss') && beaten.includes('hunter')) {
                            incrementQuestProgress('smash_boss_all');
                        }
                    } catch(err) {}
                }
            }
        }
    }

    update(dt, player, gameInstance) {
        this.animTimer += dt;
        if (this.animTimer > 0.15) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }

        // Smooth health
        if (this.displayHealth > this.health) {
            this.displayHealth -= (this.displayHealth - this.health) * 8 * dt;
            if (this.displayHealth - this.health < 0.5) this.displayHealth = this.health;
        }

        if (this.state === 'ko') {
            if (!this.grounded) {
                this.vy += GRAVITY * dt;
                this.y += this.vy * dt;
                if (this.y >= GROUND_Y) {
                    this.y = GROUND_Y;
                    this.vy = 0;
                    this.grounded = true;
                    this.vx = 0;
                }
            }
            this.x += this.vx * dt;
            return;
        }

        if (this.state === 'hurt') {
            this.hurtTimer -= dt;
            if (this.hurtTimer <= 0) {
                this.state = 'idle';
            }
            // Apply physics
            if (!this.grounded && this.type !== 'ghost') {
                this.vy += GRAVITY * dt;
            }
            this.y += this.vy * dt;
            if (this.y >= GROUND_Y && this.type !== 'ghost') {
                this.y = GROUND_Y;
                this.vy = 0;
                this.grounded = true;
            }
            this.x += this.vx * dt;
            return;
        }

        // Active State AI
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        this.facingRight = player.x > this.x;

        // Movement & Attack Decision
        const dist = Math.abs(player.x - this.x);
        const yDist = Math.abs(player.y - this.y);

        if (this.type === 'ghost') {
            // Float movement
            this.ghostFloat += dt * 3;
            const targetY = GROUND_Y - 120 + Math.sin(this.ghostFloat) * 40;
            this.y += (targetY - this.y) * 2 * dt;
            // Move toward player
            const dir = player.x > this.x ? 1 : -1;
            this.vx = dir * this.speed;
            this.x += this.vx * dt;

            // Ghost contact attack
            if (dist < 40 && yDist < 50 && this.attackCooldown <= 0) {
                player.takeHit(10, dir, 150);
                effects.spawnHitParticles(this.x, this.y - 20, '#a78bfa', 8);
                this.attackCooldown = 1.5;
            }
        } else {
            // Apply gravity
            if (this.y < GROUND_Y) {
                this.vy += GRAVITY * dt;
                this.grounded = false;
            }
            this.y += this.vy * dt;
            if (this.y >= GROUND_Y) {
                this.y = GROUND_Y;
                this.vy = 0;
                this.grounded = true;
            }

            // Normal ground movement
            const dir = player.x > this.x ? 1 : -1;

            if (this.type === 'wizard') {
                // Keep distance and shoot magic projectiles
                if (dist < 220) {
                    // Back away
                    this.vx = -dir * this.speed;
                    this.state = 'walk';
                } else if (dist > 350) {
                    this.vx = dir * this.speed;
                    this.state = 'walk';
                } else {
                    this.vx = 0;
                    this.state = 'idle';
                }

                this.shootTimer += dt;
                if (this.shootTimer > 2.0 && dist < 450) {
                    this.shootTimer = 0;
                    // Spawn magic projectile
                    gameInstance.projectiles.push({
                        x: this.x,
                        y: this.y - this.height / 2,
                        vx: dir * 350,
                        vy: 0,
                        type: 'magic',
                        fromPlayer: false,
                        radius: 8
                    });
                }
            } else if (this.type === 'robot') {
                // Slow advance and fire sparks
                this.vx = dir * this.speed;
                this.state = 'walk';

                this.shootTimer += dt;
                if (this.shootTimer > 2.5 && dist < 350) {
                    this.shootTimer = 0;
                    gameInstance.projectiles.push({
                        x: this.x + dir * 20,
                        y: this.y - this.height / 2,
                        vx: dir * 250,
                        vy: 0,
                        type: 'spark',
                        fromPlayer: false,
                        radius: 6
                    });
                }
            } else if (this.type === 'ninja') {
                // Dash and rapid strike, occasional teleport
                if (dist > 80) {
                    this.vx = dir * this.speed;
                    this.state = 'walk';
                } else {
                    this.vx = 0;
                    this.state = 'idle';
                    if (this.attackCooldown <= 0) {
                        player.takeHit(12, dir, 200);
                        effects.spawnHitParticles(player.x, player.y - 30, '#ef4444', 8);
                        this.attackCooldown = 0.8;
                    }
                }

                // Teleport behind player occasionally
                this.shootTimer += dt;
                if (this.shootTimer > 5.0 && dist > 150) {
                    this.shootTimer = 0;
                    effects.spawnHitParticles(this.x, this.y - 20, '#d946ef', 12);
                    this.x = player.x - dir * 60;
                    this.y = player.y;
                    this.facingRight = player.x > this.x;
                    effects.spawnHitParticles(this.x, this.y - 20, '#d946ef', 12);
                }
            } else if (this.type === 'giant') {
                // Slow march and smash
                if (dist > 90) {
                    this.vx = dir * this.speed;
                    this.state = 'walk';
                } else {
                    this.vx = 0;
                    this.state = 'idle';
                    if (this.attackCooldown <= 0) {
                        player.takeHit(22, dir, 450);
                        effects.spawnHitParticles(player.x, player.y - 40, '#f97316', 15);
                        if (effects.shakeScreen) effects.shakeScreen(15, 0.25);
                        this.attackCooldown = 2.0;
                    }
                }
            } else if (this.type === 'king') {
                // Boss Rat King
                if (dist > 100) {
                    this.vx = dir * this.speed;
                    this.state = 'walk';
                } else {
                    this.vx = 0;
                    this.state = 'idle';
                    if (this.attackCooldown <= 0) {
                        player.takeHit(25, dir, 400);
                        effects.spawnHitParticles(player.x, player.y - 45, '#eab308', 20);
                        this.attackCooldown = 1.8;
                    }
                }

                // Throw crowns
                this.shootTimer += dt;
                if (this.shootTimer > 3.0) {
                    this.shootTimer = 0;
                    gameInstance.projectiles.push({
                        x: this.x,
                        y: this.y - this.height + 20,
                        vx: dir * 400,
                        vy: -120, // slightly arched throwing
                        type: 'crown',
                        fromPlayer: false,
                        radius: 12
                    });

                    // Summon helper rat if below half health
                    if (this.health < this.maxHealth * 0.5 && gameInstance.enemies.length < 5) {
                        const summonX = this.x - dir * 80;
                        gameInstance.enemies.push(new EnemyRat(summonX, GROUND_Y, 'ninja'));
                        effects.spawnHitParticles(summonX, GROUND_Y - 20, '#a855f7', 10);
                    }
                }
            } else if (this.type === 'robo_boss') {
                // Boss Robo Rat
                if (dist > 110) {
                    this.vx = dir * this.speed;
                    this.state = 'walk';
                } else {
                    this.vx = 0;
                    this.state = 'idle';
                    if (this.attackCooldown <= 0) {
                        player.takeHit(28, dir, 450);
                        effects.spawnHitParticles(player.x, player.y - 45, '#3b82f6', 22);
                        this.attackCooldown = 1.5;
                    }
                }

                // Charge attack or fire missile
                this.shootTimer += dt;
                if (this.shootTimer > 4.0) {
                    this.shootTimer = 0;
                    if (Math.random() < 0.5) {
                        // Rocket Missile!
                        gameInstance.projectiles.push({
                            x: this.x,
                            y: this.y - this.height / 2,
                            vx: dir * 550,
                            vy: 0,
                            type: 'missile',
                            fromPlayer: false,
                            radius: 15
                        });
                    } else {
                        // Robo charge!
                        this.vx = dir * this.speed * 2.8;
                        this.state = 'walk';
                        if (effects.shakeScreen) effects.shakeScreen(10, 0.4);
                    }
                }
            } else if (this.type === 'hunter') {
                // Boss Cat Hunter
                if (dist > 160) {
                    this.vx = dir * this.speed;
                    this.state = 'walk';
                } else {
                    this.vx = -dir * this.speed * 0.8; // retreat slightly
                    this.state = 'walk';
                }

                // Fire arrows or traps
                this.shootTimer += dt;
                if (this.shootTimer > 2.2) {
                    this.shootTimer = 0;
                    // Hunter tracking arrow
                    const angle = Math.atan2(player.y - 30 - (this.y - this.height/2), player.x - this.x);
                    gameInstance.projectiles.push({
                        x: this.x,
                        y: this.y - this.height / 2,
                        vx: Math.cos(angle) * 480,
                        vy: Math.sin(angle) * 480,
                        type: 'arrow',
                        fromPlayer: false,
                        radius: 8
                    });
                }
            } else {
                // Default simple enemy rat
                if (dist > 60) {
                    this.vx = dir * this.speed;
                    this.state = 'walk';
                } else {
                    this.vx = 0;
                    this.state = 'idle';
                    if (this.attackCooldown <= 0) {
                        player.takeHit(8, dir, 120);
                        this.attackCooldown = 1.2;
                    }
                }
            }

            this.x += this.vx * dt;
        }

        // Bounds enforcement
        if (this.x < 30) this.x = 30;
        if (this.x > 930) this.x = 930;
        if (this.vx !== 0 && this.state !== 'ko') {
            this.state = 'walk';
        }
    }

    draw(ctx) {
        ctx.save();

        // KO rotation
        if (this.state === 'ko') {
            ctx.translate(this.x, this.y);
            ctx.rotate((this.facingRight ? 1 : -1) * Math.PI / 2.5);
            ctx.translate(-this.x, -this.y);
        }

        // Ghost alpha transparency
        if (this.type === 'ghost') {
            ctx.globalAlpha = 0.55;
        }

        const dir = this.facingRight ? 1 : -1;
        const baseY = this.y - this.height;

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(this.x, GROUND_Y + 1, this.width * 0.4, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rat body colors matching types
        let bodyColor = '#78716c';      // default grey/brown
        let bodyDarkColor = '#57534e';
        let accessoryColor = '';

        if (this.type === 'wizard') {
            bodyColor = '#5b21b6';
            bodyDarkColor = '#3b0764';
            accessoryColor = '#a855f7';
        } else if (this.type === 'robot') {
            bodyColor = '#64748b';
            bodyDarkColor = '#475569';
            accessoryColor = '#38bdf8';
        } else if (this.type === 'ninja') {
            bodyColor = '#1e293b';
            bodyDarkColor = '#0f172a';
            accessoryColor = '#f43f5e';
        } else if (this.type === 'giant') {
            bodyColor = '#b45309';
            bodyDarkColor = '#78350f';
        } else if (this.type === 'ghost') {
            bodyColor = '#cbd5e1';
            bodyDarkColor = '#94a3b8';
            accessoryColor = '#a78bfa';
        } else if (this.type === 'king') {
            bodyColor = '#b45309';
            bodyDarkColor = '#78350f';
            accessoryColor = '#eab308'; // Gold crown
        } else if (this.type === 'robo_boss') {
            bodyColor = '#334155';
            bodyDarkColor = '#1e293b';
            accessoryColor = '#ef4444'; // Red lights
        } else if (this.type === 'hunter') {
            bodyColor = '#1b4332'; // Forest green look
            bodyDarkColor = '#081c15';
            accessoryColor = '#b7094c';
        }

        // 1. Long Pink Tail
        ctx.save();
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = this.isBoss ? 4 : 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const tailOffset = Math.sin(this.animTimer * 12 + this.animFrame) * 10;
        ctx.moveTo(this.x - dir * (this.width * 0.4), baseY + this.height * 0.85);
        ctx.quadraticCurveTo(
            this.x - dir * (this.width * 0.75), baseY + this.height * 0.95 + tailOffset,
            this.x - dir * (this.width * 1.1), baseY + this.height * 0.75 + tailOffset
        );
        ctx.stroke();
        ctx.restore();

        // 2. Rat Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(this.x, baseY + this.height * 0.65, this.width * 0.45, this.height * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Belly highlight
        ctx.fillStyle = this.type === 'robot' || this.type === 'robo_boss' ? '#94a3b8' : '#e7e5e4';
        ctx.beginPath();
        ctx.ellipse(this.x + dir * 5, baseY + this.height * 0.7, this.width * 0.25, this.height * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4. Head
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(this.x + dir * (this.width * 0.35), baseY + this.height * 0.35, this.width * 0.28, this.height * 0.22, dir * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // 5. Pointy Nose Snout
        ctx.fillStyle = bodyDarkColor;
        ctx.beginPath();
        ctx.ellipse(this.x + dir * (this.width * 0.55), baseY + this.height * 0.38, this.width * 0.12, this.height * 0.08, dir * 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Nose tip
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(this.x + dir * (this.width * 0.66), baseY + this.height * 0.38, this.isBoss ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();

        // 6. Round Ears
        ctx.fillStyle = bodyDarkColor;
        ctx.beginPath();
        ctx.arc(this.x - dir * 3, baseY + this.height * 0.15, this.width * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fca5a5'; // Inner pink ear
        ctx.beginPath();
        ctx.arc(this.x - dir * 3, baseY + this.height * 0.15, this.width * 0.09, 0, Math.PI * 2);
        ctx.fill();

        // 7. Eyes
        ctx.fillStyle = this.type === 'ghost' ? '#a78bfa' : (this.type === 'robot' || this.type === 'robo_boss' ? '#38bdf8' : '#ef4444');
        ctx.beginPath();
        ctx.arc(this.x + dir * (this.width * 0.42), baseY + this.height * 0.3, this.isBoss ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();

        // 8. Custom Accessories matching Types
        if (this.type === 'wizard') {
            // Draw wizard hat
            ctx.fillStyle = accessoryColor;
            ctx.beginPath();
            ctx.moveTo(this.x - dir * 18, baseY + 8);
            ctx.lineTo(this.x + dir * 12, baseY + 8);
            ctx.lineTo(this.x - dir * 4, baseY - 22);
            ctx.closePath();
            ctx.fill();
            // Star on hat
            ctx.fillStyle = '#eab308';
            ctx.font = '10px Outfit';
            ctx.fillText('★', this.x - dir * 4, baseY - 5);
        } else if (this.type === 'robot' || this.type === 'robo_boss') {
            // Antenna
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, baseY + 10);
            ctx.lineTo(this.x, baseY - 12);
            ctx.stroke();
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(this.x, baseY - 12, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'ninja') {
            // Headband tails
            ctx.strokeStyle = accessoryColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x - dir * 12, baseY + 24);
            ctx.lineTo(this.x - dir * 28, baseY + 20 + Math.sin(this.animTimer*10)*4);
            ctx.stroke();
        } else if (this.type === 'king') {
            // King crown
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.moveTo(this.x - 22, baseY + 8);
            ctx.lineTo(this.x + 22, baseY + 8);
            ctx.lineTo(this.x + 18, baseY - 18);
            ctx.lineTo(this.x + 5, baseY - 4);
            ctx.lineTo(this.x, baseY - 24);
            ctx.lineTo(this.x - 5, baseY - 4);
            ctx.lineTo(this.x - 18, baseY - 18);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'hunter') {
            // Hunter cap
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.ellipse(this.x + dir * 4, baseY + 10, 16, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#b7094c'; // Feather on cap
            ctx.beginPath();
            ctx.moveTo(this.x - dir * 4, baseY + 8);
            ctx.quadraticCurveTo(this.x - dir * 16, baseY - 15, this.x - dir * 24, baseY - 12);
            ctx.fill();
        }

        ctx.restore();
    }
}

