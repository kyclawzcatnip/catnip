// ===== MAIN GAME =====

class Game {
    constructor() {
        this.engine = new Engine();
        this.state = 'menu'; // menu, lobby, fighting, roundEnd, matchEnd, roundStart
        this.mode = 'pvb'; // pvb, pvp, or online
        this.round = 1;
        this.timer = 60;
        this.stateTimer = 0;
        this.time = 0;

        // Power-ups
        this.powerUps = [];
        this.powerUpTimer = 0;
        this.powerUpInterval = 3 + Math.random() * 3; // first spawn 3-6 seconds

        this.fighter1 = null;
        this.fighter2 = null;
        this.botAI = new BotAI();

        // Online multiplayer state
        this.onlineMode = false;
        this.isOnlineHost = false;
        this.isOnlineGuest = false;
        this.remoteInputs = {};
        this.netSendTimer = 0;
        this.NET_SEND_INTERVAL = 3; // send every N frames
        this.netDisconnectMsg = '';
        this.netDisconnectTimer = 0;

        // Guest state tracking
        this.guestPrevState = '';
        this.guestMatchEndTimer = 0;

        // Lobby DOM elements
        this.lobbyOverlay = document.getElementById('lobby-overlay');
        this.lobbyMenu = document.getElementById('lobby-menu');
        this.lobbyWaiting = document.getElementById('lobby-waiting');
        this.lobbyRoomCode = document.getElementById('lobby-room-code');
        this.lobbyStatus = document.getElementById('lobby-status');
        this.lobbyDot = document.getElementById('lobby-dot');
        this.lobbyConnText = document.getElementById('lobby-connection-text');
        this.joinCodeInput = document.getElementById('join-code-input');

        this.setupMenu();
        this.setupLobby();
        this.engine.start(
            (dt) => this.update(dt),
            (ctx) => this.draw(ctx)
        );
    }

    setupMenu() {
        const menu = document.getElementById('menu-overlay');
        const btnPvB = document.getElementById('btn-pvb');
        const btnPvP = document.getElementById('btn-pvp');
        const btnOnline = document.getElementById('btn-online');

        btnPvB.addEventListener('click', () => {
            audio.ensureContext();
            audio.playMenuSelect();
            this.mode = 'pvb';
            menu.classList.add('hidden');
            this.startMatch();
        });

        btnPvP.addEventListener('click', () => {
            audio.ensureContext();
            audio.playMenuSelect();
            this.mode = 'pvp';
            menu.classList.add('hidden');
            this.startMatch();
        });

        btnOnline.addEventListener('click', () => {
            audio.ensureContext();
            audio.playMenuSelect();
            this.openLobby();
        });
    }

    setupLobby() {
        const btnHost = document.getElementById('btn-host');
        const btnJoin = document.getElementById('btn-join');
        const btnBack = document.getElementById('btn-lobby-back');

        btnHost.addEventListener('click', () => this.lobbyHost());
        btnJoin.addEventListener('click', () => this.lobbyJoin());
        btnBack.addEventListener('click', () => this.closeLobby());
    }

    // ===== LOBBY MANAGEMENT =====

    openLobby() {
        this.state = 'lobby';
        document.getElementById('menu-overlay').classList.add('hidden');
        this.lobbyOverlay.classList.remove('hidden');
        this.lobbyMenu.style.display = '';
        this.lobbyWaiting.classList.add('hidden');
        this.lobbyStatus.textContent = '';
        if (this.joinCodeInput) this.joinCodeInput.value = '';
    }

    closeLobby() {
        this.lobbyOverlay.classList.add('hidden');
        NetworkManager.disconnect();
        this.onlineMode = false;
        this.isOnlineHost = false;
        this.isOnlineGuest = false;
        this.returnToMenu();
    }

    startOnlineGame() {
        this.mode = 'online';
        this.onlineMode = true;
        this.lobbyOverlay.classList.add('hidden');
        this.startMatch();
    }

    async lobbyHost() {
        this.lobbyStatus.textContent = '';
        this.lobbyMenu.style.display = 'none';
        this.lobbyWaiting.classList.remove('hidden');
        this.lobbyConnText.textContent = 'Creating room...';
        this.lobbyDot.classList.remove('connected');

        try {
            const code = await NetworkManager.host({
                onConnect: () => {
                    this.lobbyDot.classList.add('connected');
                    this.lobbyConnText.textContent = 'Player joined! Starting...';
                    this.isOnlineHost = true;
                    this.isOnlineGuest = false;
                    setTimeout(() => {
                        NetworkManager.send({ type: 'start' });
                        this.startOnlineGame();
                    }, 1000);
                },
                onDisconnect: () => {
                    if (this.state === 'fighting' || this.state === 'roundStart' || this.state === 'roundEnd') {
                        this.netDisconnectMsg = 'OPPONENT DISCONNECTED';
                        this.netDisconnectTimer = 3;
                        this.onlineMode = false;
                        this.isOnlineHost = false;
                    }
                },
                onData: (data) => {
                    if (data && data.type === 'input') {
                        this.remoteInputs = data.keys;
                    }
                },
                onError: (err) => {
                    this.lobbyStatus.textContent = 'Error: ' + (err.message || err.type);
                }
            });

            this.lobbyRoomCode.textContent = code;
            this.lobbyConnText.textContent = 'Waiting for player...';

            // Click to copy
            this.lobbyRoomCode.onclick = () => {
                navigator.clipboard.writeText(code).then(() => {
                    this.lobbyConnText.textContent = 'Code copied!';
                    setTimeout(() => { this.lobbyConnText.textContent = 'Waiting for player...'; }, 1500);
                }).catch(() => {});
            };
        } catch (err) {
            this.lobbyStatus.textContent = 'Failed to host: ' + (err.message || err.type);
            this.lobbyMenu.style.display = '';
            this.lobbyWaiting.classList.add('hidden');
        }
    }

    async lobbyJoin() {
        const code = this.joinCodeInput ? this.joinCodeInput.value.trim() : '';
        if (code.length !== 4) {
            this.lobbyStatus.textContent = 'Enter a 4-character room code';
            return;
        }

        this.lobbyStatus.textContent = '';
        this.lobbyMenu.style.display = 'none';
        this.lobbyWaiting.classList.remove('hidden');
        this.lobbyRoomCode.textContent = code.toUpperCase();
        this.lobbyConnText.textContent = 'Connecting...';
        this.lobbyDot.classList.remove('connected');

        try {
            await NetworkManager.join(code, {
                onConnect: () => {
                    this.lobbyDot.classList.add('connected');
                    this.lobbyConnText.textContent = 'Connected! Waiting for host...';
                    this.isOnlineGuest = true;
                    this.isOnlineHost = false;
                },
                onDisconnect: () => {
                    if (this.state === 'fighting' || this.state === 'roundStart' || this.state === 'roundEnd') {
                        this.netDisconnectMsg = 'HOST DISCONNECTED';
                        this.netDisconnectTimer = 3;
                        this.onlineMode = false;
                        this.isOnlineGuest = false;
                    }
                },
                onData: (data) => {
                    if (data && data.type === 'state') {
                        this.applyHostState(data);
                    }
                    if (data && data.type === 'start') {
                        this.startOnlineGame();
                    }
                },
                onError: (err) => {
                    this.lobbyStatus.textContent = 'Error: ' + (err.message || err.type);
                }
            });
        } catch (err) {
            this.lobbyStatus.textContent = 'Failed to join: ' + (err.message || err.type);
            this.lobbyMenu.style.display = '';
            this.lobbyWaiting.classList.add('hidden');
        }
    }

    // ===== MATCH / ROUND MANAGEMENT =====

    startMatch() {
        this.fighter1 = new Fighter(250, true, CAT_COLORS.orange, 'Ginger');
        this.fighter2 = new Fighter(710, false, CAT_COLORS.gray, 'Shadow');
        this.fighter1.wins = 0;
        this.fighter2.wins = 0;
        this.round = 1;
        this.startRound();
    }

    startRound() {
        this.fighter1.reset(250, true);
        this.fighter2.reset(710, false);
        this.timer = 60;
        this.state = 'roundStart';
        this.stateTimer = 0;
        effects.clear();
        this.powerUps = [];
        this.powerUpTimer = 0;
        this.powerUpInterval = 3 + Math.random() * 3;

        if (this.round <= 2 || (this.fighter1.wins < 2 && this.fighter2.wins < 2)) {
            gameUI.showRoundAnnouncement(`ROUND ${this.round}`);
            audio.playRoundStart();
        }
    }

    handleInput(dt) {
        if (this.state !== 'fighting') return;

        const keys = this.engine.keys;

        // Player 1 controls (WASD + FG) — always local on the host or in local modes
        if (this.fighter1.state !== STATES.KO) {
            // Movement
            if (keys['KeyA'] && this.fighter1.canAct()) {
                this.fighter1.vx = -MOVE_SPEED;
                if (this.fighter1.grounded && this.fighter1.state !== STATES.PUNCH && this.fighter1.state !== STATES.KICK) {
                    this.fighter1.state = STATES.WALK;
                }
            } else if (keys['KeyD'] && this.fighter1.canAct()) {
                this.fighter1.vx = MOVE_SPEED;
                if (this.fighter1.grounded && this.fighter1.state !== STATES.PUNCH && this.fighter1.state !== STATES.KICK) {
                    this.fighter1.state = STATES.WALK;
                }
            } else if (this.fighter1.state === STATES.WALK) {
                this.fighter1.state = STATES.IDLE;
                this.fighter1.vx = 0;
            }

            // Jump
            if (keys['KeyW']) {
                this.fighter1.jump();
            }

            // Block
            if (keys['KeyS'] && this.fighter1.grounded) {
                this.fighter1.startBlock();
            } else if (!keys['KeyS'] && this.fighter1.state === STATES.BLOCK) {
                this.fighter1.stopBlock();
            }

            // Attacks
            if (keys['KeyF']) {
                this.fighter1.startAttack('punch');
                keys['KeyF'] = false; // Prevent repeat
            }
            if (keys['KeyG']) {
                this.fighter1.startAttack('kick');
                keys['KeyG'] = false;
            }
        }

        // Player 2 / Bot / Online Remote controls
        if (this.mode === 'pvp') {
            this.handleLocalPlayer2(keys);
        } else if (this.mode === 'online' && this.isOnlineHost) {
            this.handleRemotePlayer2();
        } else if (this.mode === 'pvb') {
            // Bot AI
            this.botAI.update(dt, this.fighter2, this.fighter1);
            this.botAI.applyAction(this.fighter2, this.fighter1, this.engine.keys);

            // Apply bot movement from simulated keys
            if (this.fighter2.state !== STATES.KO) {
                if (this.engine.keys['bot_left'] && this.fighter2.canAct()) {
                    this.fighter2.vx = -MOVE_SPEED;
                    if (this.fighter2.grounded) this.fighter2.state = STATES.WALK;
                } else if (this.engine.keys['bot_right'] && this.fighter2.canAct()) {
                    this.fighter2.vx = MOVE_SPEED;
                    if (this.fighter2.grounded) this.fighter2.state = STATES.WALK;
                } else if (this.fighter2.state === STATES.WALK) {
                    this.fighter2.state = STATES.IDLE;
                    this.fighter2.vx = 0;
                }

                if (this.engine.keys['bot_block'] && this.fighter2.grounded) {
                    this.fighter2.startBlock();
                } else if (!this.engine.keys['bot_block'] && this.fighter2.state === STATES.BLOCK) {
                    this.fighter2.stopBlock();
                }
            }
        }
    }

    handleLocalPlayer2(keys) {
        if (this.fighter2.state !== STATES.KO) {
            // Movement
            if (keys['ArrowLeft'] && this.fighter2.canAct()) {
                this.fighter2.vx = -MOVE_SPEED;
                if (this.fighter2.grounded && this.fighter2.state !== STATES.PUNCH && this.fighter2.state !== STATES.KICK) {
                    this.fighter2.state = STATES.WALK;
                }
            } else if (keys['ArrowRight'] && this.fighter2.canAct()) {
                this.fighter2.vx = MOVE_SPEED;
                if (this.fighter2.grounded && this.fighter2.state !== STATES.PUNCH && this.fighter2.state !== STATES.KICK) {
                    this.fighter2.state = STATES.WALK;
                }
            } else if (this.fighter2.state === STATES.WALK) {
                this.fighter2.state = STATES.IDLE;
                this.fighter2.vx = 0;
            }

            // Jump
            if (keys['ArrowUp']) {
                this.fighter2.jump();
            }

            // Block
            if (keys['ArrowDown'] && this.fighter2.grounded) {
                this.fighter2.startBlock();
            } else if (!keys['ArrowDown'] && this.fighter2.state === STATES.BLOCK) {
                this.fighter2.stopBlock();
            }

            // Attacks
            if (keys['Numpad1']) {
                this.fighter2.startAttack('punch');
                keys['Numpad1'] = false;
            }
            if (keys['Numpad2']) {
                this.fighter2.startAttack('kick');
                keys['Numpad2'] = false;
            }
        }
    }

    handleRemotePlayer2() {
        // Host applies remote inputs from the guest
        const ri = this.remoteInputs;
        if (!ri || this.fighter2.state === STATES.KO) return;

        // Movement
        if (ri.left && this.fighter2.canAct()) {
            this.fighter2.vx = -MOVE_SPEED;
            if (this.fighter2.grounded && this.fighter2.state !== STATES.PUNCH && this.fighter2.state !== STATES.KICK) {
                this.fighter2.state = STATES.WALK;
            }
        } else if (ri.right && this.fighter2.canAct()) {
            this.fighter2.vx = MOVE_SPEED;
            if (this.fighter2.grounded && this.fighter2.state !== STATES.PUNCH && this.fighter2.state !== STATES.KICK) {
                this.fighter2.state = STATES.WALK;
            }
        } else if (this.fighter2.state === STATES.WALK) {
            this.fighter2.state = STATES.IDLE;
            this.fighter2.vx = 0;
        }

        // Jump
        if (ri.jump) {
            this.fighter2.jump();
        }

        // Block
        if (ri.block && this.fighter2.grounded) {
            this.fighter2.startBlock();
        } else if (!ri.block && this.fighter2.state === STATES.BLOCK) {
            this.fighter2.stopBlock();
        }

        // Attacks
        if (ri.punch) {
            this.fighter2.startAttack('punch');
            ri.punch = false;
        }
        if (ri.kick) {
            this.fighter2.startAttack('kick');
            ri.kick = false;
        }
    }

    // ===== NETWORK SYNC =====

    networkSync() {
        if (!this.onlineMode || !NetworkManager.isConnected) return;

        this.netSendTimer++;
        if (this.netSendTimer < this.NET_SEND_INTERVAL) return;
        this.netSendTimer = 0;

        if (this.isOnlineHost) {
            // Host sends full game state to guest
            const stateData = {
                type: 'state',
                state: this.state,
                round: this.round,
                timer: Math.round(this.timer * 100) / 100,
                f1: this.serializeFighter(this.fighter1),
                f2: this.serializeFighter(this.fighter2),
                f1wins: this.fighter1.wins,
                f2wins: this.fighter2.wins,
                stateTimer: Math.round(this.stateTimer * 100) / 100,
                // Send announcement info so guest can display it
                announcement: gameUI.showRoundText ? gameUI.roundText : null,
                // Send power-ups for guest rendering
                powerUps: this.powerUps.map(p => ({
                    x: Math.round(p.x), y: Math.round(p.y),
                    type: p.type, time: Math.round(p.time * 100) / 100
                }))
            };
            NetworkManager.send(stateData);
        }

        if (this.isOnlineGuest) {
            // Guest sends local inputs to host (using WASD as the guest's controls)
            const keys = this.engine.keys;
            const inputData = {
                type: 'input',
                keys: {
                    left: !!keys['KeyA'],
                    right: !!keys['KeyD'],
                    jump: !!keys['KeyW'],
                    block: !!keys['KeyS'],
                    punch: !!keys['KeyF'],
                    kick: !!keys['KeyG']
                }
            };
            NetworkManager.send(inputData);
            // Reset one-shot attack keys after sending
            keys['KeyF'] = false;
            keys['KeyG'] = false;
        }
    }

    serializeFighter(f) {
        return {
            x: Math.round(f.x),
            y: Math.round(f.y),
            vx: Math.round(f.vx),
            vy: Math.round(f.vy),
            health: f.health,
            displayHealth: Math.round(f.displayHealth),
            state: f.state,
            stateTimer: Math.round(f.stateTimer * 1000) / 1000,
            attackPhase: f.attackPhase,
            attackType: f.attackType,
            facingRight: f.facingRight,
            grounded: f.grounded,
            animFrame: f.animFrame,
            animTimer: Math.round(f.animTimer * 1000) / 1000,
            hurtTimer: Math.round(f.hurtTimer * 1000) / 1000,
            comboCount: f.comboCount,
            comboTimer: Math.round(f.comboTimer * 1000) / 1000,
            hasHit: f.hasHit,
            wins: f.wins,
            regenTimer: Math.round(f.regenTimer * 100) / 100,
            shieldBuff: f.shieldBuff,
            shieldTimer: Math.round(f.shieldTimer * 100) / 100
        };
    }

    applyHostState(data) {
        if (!this.fighter1 || !this.fighter2) return;

        const prevState = this.guestPrevState;
        const newState = data.state || this.state;

        // Detect state transitions and trigger guest-side effects
        if (prevState !== newState) {
            // Round end → play KO sound and effects
            if (newState === 'roundEnd' && prevState === 'fighting') {
                audio.playKO();
                effects.triggerFlash('#fff');
                effects.triggerScreenShake(15);
            }
            // Match end → start timer to return to menu
            if (newState === 'matchEnd') {
                audio.playVictory();
                this.guestMatchEndTimer = 5;
            }
        }

        // Apply game state
        if (data.state) this.state = data.state;
        this.guestPrevState = this.state;
        if (data.round !== undefined) this.round = data.round;
        if (data.timer !== undefined) this.timer = data.timer;
        if (data.stateTimer !== undefined) this.stateTimer = data.stateTimer;

        // Apply fighter states
        if (data.f1) this.applyFighterState(this.fighter1, data.f1);
        if (data.f2) this.applyFighterState(this.fighter2, data.f2);

        // Apply wins
        if (data.f1wins !== undefined) this.fighter1.wins = data.f1wins;
        if (data.f2wins !== undefined) this.fighter2.wins = data.f2wins;

        // Apply announcement from host
        if (data.announcement && data.announcement !== this._lastAnnouncement) {
            gameUI.showRoundAnnouncement(data.announcement);
            this._lastAnnouncement = data.announcement;
        } else if (!data.announcement) {
            this._lastAnnouncement = null;
        }

        // Apply power-ups from host
        if (data.powerUps) {
            this.powerUps = data.powerUps;
        }
    }

    applyFighterState(fighter, data) {
        fighter.x = data.x;
        fighter.y = data.y;
        fighter.vx = data.vx;
        fighter.vy = data.vy;
        fighter.health = data.health;
        fighter.displayHealth = data.displayHealth;
        fighter.state = data.state;
        fighter.stateTimer = data.stateTimer;
        fighter.attackPhase = data.attackPhase;
        fighter.attackType = data.attackType;
        fighter.facingRight = data.facingRight;
        fighter.grounded = data.grounded;
        fighter.animFrame = data.animFrame;
        fighter.animTimer = data.animTimer;
        fighter.hurtTimer = data.hurtTimer;
        fighter.comboCount = data.comboCount;
        fighter.comboTimer = data.comboTimer;
        fighter.hasHit = data.hasHit;
        fighter.wins = data.wins;
        // Buff states
        if (data.regenTimer !== undefined) fighter.regenTimer = data.regenTimer;
        if (data.shieldBuff !== undefined) fighter.shieldBuff = data.shieldBuff;
        if (data.shieldTimer !== undefined) fighter.shieldTimer = data.shieldTimer;
    }

    // ===== HIT DETECTION =====

    checkHits() {
        if (this.state !== 'fighting') return;

        // Fighter 1 hitting Fighter 2
        if (!this.fighter1.hasHit && checkHit(this.fighter1, this.fighter2)) {
            this.fighter1.hasHit = true;
            const data = ATTACK_DATA[this.fighter1.attackType];
            const dir = this.fighter1.facingRight ? 1 : -1;

            // Combo tracking
            this.fighter1.comboCount++;
            this.fighter1.comboTimer = 1.0;
            const comboMultiplier = 1 + (this.fighter1.comboCount - 1) * 0.15;
            const finalDamage = Math.floor(data.damage * comboMultiplier);

            const result = this.fighter2.takeHit(finalDamage, dir, data.knockback);

            // Effects
            const hitX = (this.fighter1.x + this.fighter2.x) / 2;
            const hitY = this.fighter1.y - 50;

            if (result.blocked) {
                effects.spawnHitParticles(hitX, hitY, '#67e8f9', 4);
                effects.addFloatingText(hitX, hitY - 20, 'BLOCKED!', '#67e8f9', 18);
            } else {
                if (this.fighter1.attackType === 'kick') {
                    audio.playKick();
                    effects.spawnHitParticles(hitX, hitY, '#ef4444', 12);
                    effects.spawnHitSpark(hitX, hitY, '#f59e0b');
                    effects.triggerScreenShake(10);
                } else {
                    audio.playPunch();
                    effects.spawnHitParticles(hitX, hitY, '#f59e0b', 8);
                    effects.spawnHitSpark(hitX, hitY, '#fbbf24');
                    effects.triggerScreenShake(6);
                }

                effects.addFloatingText(hitX, hitY - 20, `-${result.actualDamage}`, '#ef4444', 22);

                if (this.fighter1.comboCount > 1) {
                    effects.addFloatingText(hitX, hitY - 45, `${this.fighter1.comboCount} HIT COMBO!`, '#f59e0b', 16);
                }
            }

            if (this.fighter2.health <= 0) {
                this.onFighterKO(this.fighter1, this.fighter2);
            }
        }

        // Fighter 2 hitting Fighter 1
        if (!this.fighter2.hasHit && checkHit(this.fighter2, this.fighter1)) {
            this.fighter2.hasHit = true;
            const data = ATTACK_DATA[this.fighter2.attackType];
            const dir = this.fighter2.facingRight ? 1 : -1;

            this.fighter2.comboCount++;
            this.fighter2.comboTimer = 1.0;
            const comboMultiplier = 1 + (this.fighter2.comboCount - 1) * 0.15;
            const finalDamage = Math.floor(data.damage * comboMultiplier);

            const result = this.fighter1.takeHit(finalDamage, dir, data.knockback);

            const hitX = (this.fighter1.x + this.fighter2.x) / 2;
            const hitY = this.fighter2.y - 50;

            if (result.blocked) {
                effects.spawnHitParticles(hitX, hitY, '#67e8f9', 4);
                effects.addFloatingText(hitX, hitY - 20, 'BLOCKED!', '#67e8f9', 18);
            } else {
                if (this.fighter2.attackType === 'kick') {
                    audio.playKick();
                    effects.spawnHitParticles(hitX, hitY, '#ef4444', 12);
                    effects.spawnHitSpark(hitX, hitY, '#8b5cf6');
                    effects.triggerScreenShake(10);
                } else {
                    audio.playPunch();
                    effects.spawnHitParticles(hitX, hitY, '#8b5cf6', 8);
                    effects.spawnHitSpark(hitX, hitY, '#a78bfa');
                    effects.triggerScreenShake(6);
                }

                effects.addFloatingText(hitX, hitY - 20, `-${result.actualDamage}`, '#ef4444', 22);

                if (this.fighter2.comboCount > 1) {
                    effects.addFloatingText(hitX, hitY - 45, `${this.fighter2.comboCount} HIT COMBO!`, '#8b5cf6', 16);
                }
            }

            if (this.fighter1.health <= 0) {
                this.onFighterKO(this.fighter2, this.fighter1);
            }
        }
    }

    onFighterKO(winner, loser) {
        audio.playKO();
        effects.triggerFlash('#fff');
        effects.triggerScreenShake(15);
        this.state = 'roundEnd';
        this.stateTimer = 0;
        winner.wins++;

        setTimeout(() => {
            if (winner.wins >= 3) {
                gameUI.showRoundAnnouncement(`${winner.name.toUpperCase()} WINS!`);
                audio.playVictory();
                this.state = 'matchEnd';
                this.stateTimer = 0;
            } else {
                gameUI.showRoundAnnouncement(`${winner.name.toUpperCase()} wins round ${this.round}!`);
                this.round++;
                setTimeout(() => this.startRound(), 2500);
            }
        }, 1500);
    }

    onTimeUp() {
        this.state = 'roundEnd';
        this.stateTimer = 0;

        const winner = this.fighter1.health > this.fighter2.health ? this.fighter1 :
            this.fighter2.health > this.fighter1.health ? this.fighter2 : null;

        if (winner) {
            winner.wins++;
            setTimeout(() => {
                if (winner.wins >= 3) {
                    gameUI.showRoundAnnouncement(`${winner.name.toUpperCase()} WINS!`);
                    audio.playVictory();
                    this.state = 'matchEnd';
                    this.stateTimer = 0;
                } else {
                    gameUI.showRoundAnnouncement(`TIME UP! ${winner.name.toUpperCase()} wins!`);
                    this.round++;
                    setTimeout(() => this.startRound(), 2500);
                }
            }, 1000);
        } else {
            // Draw - replay round
            gameUI.showRoundAnnouncement('DRAW!');
            setTimeout(() => this.startRound(), 2500);
        }
    }

    // ===== GAME LOOP =====

    update(dt) {
        this.time += dt;

        if (this.state === 'menu' || this.state === 'lobby') return;

        // Network sync — always runs for online mode
        if (this.onlineMode) {
            this.networkSync();
        }

        // Guest doesn't run game logic — host sends state
        if (this.isOnlineGuest) {
            // Still update effects and UI locally for smooth rendering
            effects.update(dt);
            gameUI.updateAnnouncement(dt);

            // Handle match end — return to menu after delay
            if (this.state === 'matchEnd') {
                this.guestMatchEndTimer -= dt;
                if (this.guestMatchEndTimer <= 0) {
                    NetworkManager.disconnect();
                    this.onlineMode = false;
                    this.isOnlineGuest = false;
                    this.returnToMenu();
                }
            }

            // Handle disconnect timer
            if (this.netDisconnectTimer > 0) {
                this.netDisconnectTimer -= dt;
                if (this.netDisconnectTimer <= 0) {
                    this.netDisconnectMsg = '';
                    NetworkManager.disconnect();
                    this.returnToMenu();
                }
            }
            return;
        }

        // Round start countdown
        if (this.state === 'roundStart') {
            this.stateTimer += dt;
            if (this.stateTimer >= 2.0) {
                this.state = 'fighting';
                gameUI.showRoundAnnouncement('FIGHT!');
            }
        }

        // Fighting state
        if (this.state === 'fighting') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 0;
                this.onTimeUp();
                return;
            }

            this.handleInput(dt);
            this.fighter1.update(dt, this.fighter2);
            this.fighter2.update(dt, this.fighter1);
            this.checkHits();

            // Power-up system
            this.updatePowerUps(dt);
        }

        // Round end / match end - still update physics for falling bodies
        if (this.state === 'roundEnd' || this.state === 'matchEnd') {
            this.fighter1.update(dt, this.fighter2);
            this.fighter2.update(dt, this.fighter1);
            this.stateTimer += dt;

            // Match end - return to menu after delay
            if (this.state === 'matchEnd' && this.stateTimer > 5) {
                if (this.onlineMode) {
                    NetworkManager.disconnect();
                    this.onlineMode = false;
                    this.isOnlineHost = false;
                    this.isOnlineGuest = false;
                }
                this.returnToMenu();
            }
        }

        // Disconnect timer
        if (this.netDisconnectTimer > 0) {
            this.netDisconnectTimer -= dt;
            if (this.netDisconnectTimer <= 0) {
                this.netDisconnectMsg = '';
                NetworkManager.disconnect();
                this.returnToMenu();
            }
        }

        effects.update(dt);
        gameUI.updateAnnouncement(dt);
    }

    returnToMenu() {
        this.state = 'menu';
        const menu = document.getElementById('menu-overlay');
        menu.classList.remove('hidden');
    }

    draw(ctx) {
        // Always draw background
        gameUI.drawBackground(ctx, this.time);

        if (this.state === 'menu' || this.state === 'lobby') return;

        // Draw fighters
        if (this.fighter1) this.fighter1.draw(ctx);
        if (this.fighter2) this.fighter2.draw(ctx);

        // Draw effects
        effects.draw(ctx);

        // Draw power-ups
        this.drawPowerUps(ctx);

        // Draw buff indicators on fighters
        if (this.fighter1) this.drawBuffIndicators(ctx, this.fighter1);
        if (this.fighter2) this.drawBuffIndicators(ctx, this.fighter2);

        // Draw HUD
        if (this.fighter1 && this.fighter2) {
            gameUI.drawHUD(ctx, this.fighter1, this.fighter2, this.timer, this.round);
        }

        // Draw announcement
        gameUI.drawAnnouncement(ctx);

        // Draw online indicator
        if (this.onlineMode) {
            this.drawOnlineIndicator(ctx);
        }

        // Draw disconnect message
        if (this.netDisconnectMsg) {
            this.drawDisconnectMessage(ctx);
        }
    }

    drawOnlineIndicator(ctx) {
        // Small online indicator in bottom-right
        ctx.save();
        ctx.font = 'bold 11px Outfit';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
        const label = this.isOnlineHost ? '📡 HOST' : '🔗 GUEST';
        ctx.fillText(label, ctx.canvas.width - 12, ctx.canvas.height - 12);
        ctx.restore();
    }

    drawDisconnectMessage(ctx) {
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, H / 2 - 30, W, 60);
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(this.netDisconnectMsg, W / 2, H / 2);
        ctx.restore();
    }

    // ===== POWER-UP SYSTEM =====

    spawnPowerUp() {
        const types = ['regen', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];
        const x = 100 + Math.random() * 760; // within arena bounds
        this.powerUps.push({
            x: x,
            y: -20,
            type: type,
            time: 0,
            collected: false
        });
    }

    updatePowerUps(dt) {
        // Spawn timer
        this.powerUpTimer += dt;
        if (this.powerUpTimer >= this.powerUpInterval) {
            this.powerUpTimer = 0;
            this.powerUpInterval = 6 + Math.random() * 6;
            this.spawnPowerUp();
        }

        // Update existing power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const p = this.powerUps[i];
            p.time += dt;
            p.y += 55 * dt; // fall speed

            // Remove if fallen below ground
            if (p.y > GROUND_Y + 20) {
                this.powerUps.splice(i, 1);
                continue;
            }

            // Check collision with fighters
            const pSize = 18;
            const fighters = [this.fighter1, this.fighter2];
            for (const f of fighters) {
                if (f.state === STATES.KO) continue;
                const dx = Math.abs(p.x - f.x);
                const dy = Math.abs(p.y - (f.y - f.height / 2));
                if (dx < pSize + f.width / 2 && dy < pSize + f.height / 2) {
                    // Collect!
                    this.applyPowerUp(f, p.type);
                    effects.spawnHitParticles(p.x, p.y, p.type === 'regen' ? '#22c55e' : '#3b82f6', 10);
                    effects.addFloatingText(p.x, p.y - 20,
                        p.type === 'regen' ? '+REGEN' : '+SHIELD',
                        p.type === 'regen' ? '#22c55e' : '#3b82f6', 18);
                    audio.playPowerUp();
                    this.powerUps.splice(i, 1);
                    break;
                }
            }
        }
    }

    applyPowerUp(fighter, type) {
        if (type === 'regen') {
            fighter.regenTimer = 3;
            fighter.regenTotal = 0;
        } else if (type === 'shield') {
            fighter.shieldBuff = true;
            fighter.shieldTimer = 5;
        }
    }

    drawPowerUps(ctx) {
        for (const p of this.powerUps) {
            const bob = Math.sin(p.time * 3) * 4;
            const px = p.x;
            const py = p.y + bob;
            const glow = 0.4 + Math.sin(p.time * 4) * 0.2;

            ctx.save();

            // Glow
            ctx.shadowColor = p.type === 'regen' ? '#22c55e' : '#3b82f6';
            ctx.shadowBlur = 15 + Math.sin(p.time * 5) * 5;

            // Background circle
            ctx.fillStyle = p.type === 'regen'
                ? `rgba(34, 197, 94, ${glow})`
                : `rgba(59, 130, 246, ${glow})`;
            ctx.beginPath();
            ctx.arc(px, py, 16, 0, Math.PI * 2);
            ctx.fill();

            // Border
            ctx.strokeStyle = p.type === 'regen' ? '#4ade80' : '#60a5fa';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Icon
            ctx.font = '16px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(p.type === 'regen' ? '❤️' : '🛡️', px, py);

            ctx.restore();
        }
    }

    drawBuffIndicators(ctx, fighter) {
        let indicators = [];
        if (fighter.regenTimer > 0) {
            indicators.push({ icon: '❤️', color: '#22c55e', timer: fighter.regenTimer });
        }
        if (fighter.shieldBuff) {
            indicators.push({ icon: '🛡️', color: '#3b82f6', timer: fighter.shieldTimer });
        }
        if (indicators.length === 0) return;

        ctx.save();
        indicators.forEach((ind, i) => {
            const bx = fighter.x - 12 + i * 22;
            const by = fighter.y - fighter.height - 20;

            // Small icon above head
            ctx.font = '12px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(ind.icon, bx, by);

            // Timer bar underneath
            const maxTime = ind.icon === '❤️' ? 3 : 5;
            const ratio = ind.timer / maxTime;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(bx - 8, by + 4, 16, 3);
            ctx.fillStyle = ind.color;
            ctx.fillRect(bx - 8, by + 4, 16 * ratio, 3);
        });
        ctx.restore();
    }
}

// Start the game!
window.addEventListener('load', () => {
    new Game();
});
