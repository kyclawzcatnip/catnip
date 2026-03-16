// ===== BOT AI =====

class BotAI {
    constructor() {
        this.decisionTimer = 0;
        this.decisionInterval = 0.15; // How often bot makes decisions
        this.currentAction = 'idle';
        this.reactionDelay = 0.12; // Simulates reaction time
        this.aggressiveness = 0.6; // 0-1, higher = more aggressive
        this.blockChance = 0.4; // Chance to block when attacked
    }

    update(dt, bot, player) {
        if (bot.state === STATES.KO) return;

        this.decisionTimer += dt;
        if (this.decisionTimer < this.decisionInterval) return;
        this.decisionTimer = 0;

        const dist = Math.abs(bot.x - player.x);
        const isPlayerAttacking = player.state === STATES.PUNCH || player.state === STATES.KICK;
        const isPlayerClose = dist < 100;
        const isInRange = dist < 85;

        // Decision tree
        if (isPlayerAttacking && isPlayerClose && Math.random() < this.blockChance) {
            // Block incoming attack
            this.currentAction = 'block';
        } else if (isInRange && Math.random() < this.aggressiveness) {
            // Attack!
            if (Math.random() < 0.6) {
                this.currentAction = 'punch';
            } else {
                this.currentAction = 'kick';
            }
        } else if (dist > 120) {
            // Approach player
            this.currentAction = 'approach';
        } else if (dist < 60 && Math.random() < 0.3) {
            // Too close, back off sometimes
            this.currentAction = 'retreat';
        } else if (Math.random() < 0.15 && bot.grounded) {
            // Random jump
            this.currentAction = 'jump';
        } else {
            this.currentAction = 'approach';
        }
    }

    applyAction(bot, player, keys) {
        if (bot.state === STATES.KO) return;

        // Clear simulated bot keys
        keys['bot_left'] = false;
        keys['bot_right'] = false;
        keys['bot_block'] = false;

        switch (this.currentAction) {
            case 'approach':
                if (player.x < bot.x) {
                    keys['bot_left'] = true;
                } else {
                    keys['bot_right'] = true;
                }
                break;

            case 'retreat':
                if (player.x < bot.x) {
                    keys['bot_right'] = true;
                } else {
                    keys['bot_left'] = true;
                }
                break;

            case 'punch':
                if (bot.canAct()) {
                    bot.startAttack('punch');
                }
                break;

            case 'kick':
                if (bot.canAct()) {
                    bot.startAttack('kick');
                }
                break;

            case 'block':
                keys['bot_block'] = true;
                break;

            case 'jump':
                bot.jump();
                break;
        }
    }
}
