// ================= CONFIGURAÇÕES =================
const config = { useImages: true, soundOn: true };

// ================= SISTEMA DE ÁUDIO =================
const AudioSys = {
    sounds: {},
    lastPlay: {},
    
    load: function() {
        const list = {
            // EFEITOS
            'eat': 'comer.mp3', 
            'boom': 'explosao.mp3', 
            'nuke': 'nuclear.mp3',
            'power': 'powerup.mp3', 
            'hurt': 'dano.mp3', 
            'over': 'gameover.mp3',
            'heal': 'powerup.mp3', 
            'pop': 'comer.mp3', 
            'awawa': 'awawa.mp3',
            'hud_select': 'hud_select.mp3', 
            'click': 'comer.mp3', 
            'shield_up': 'powerup.mp3', 
            'shield_break': 'explosao.mp3',
            'super_start': 'powerup.mp3',
            
            // ITENS ESPECIAIS (NOVO)
            'pamonha': 'pamonha.mp3',
            'pao_de_queijo': 'pao_de_queijo.mp3',
            
            // MÚSICAS
            'menu_bgm': 'menu_theme.mp3', 
            'bgm': 'musica.mp3', 
            'bgm_sabara': 'musica_sabara.mp3', 
            'bgm_goiania': 'musica_goiania.mp3',
            'bgm_russia': 'musica_russia.mp3'
        };
        for(let k in list) {
            this.sounds[k] = new Audio(list[k]);
            if(k.includes('bgm')) { 
                this.sounds[k].loop = true; 
                this.sounds[k].volume = 0.4; 
            }
        }
    },
    
    play: function(key, rate=1.0) {
        if(!config.soundOn || !this.sounds[key]) return;
        const now = Date.now();
        // Evita spam de som (exceto explosões e itens raros)
        if(!['pamonha','pao_de_queijo'].includes(key)) {
            if(this.lastPlay[key] && now - this.lastPlay[key] < 50) return; 
        }
        this.lastPlay[key] = now;

        const s = this.sounds[key];
        
        if(key.includes('bgm')) {
            s.currentTime = 0; s.play().catch(()=>{});
        } else {
            const clone = s.cloneNode();
            clone.volume = 0.6; clone.playbackRate = rate;
            clone.play().catch(()=>{});
        }
    },
    
    stop: function(key) { if(this.sounds[key]) { this.sounds[key].pause(); this.sounds[key].currentTime = 0; } },
    
    stopAllMusic: function() { 
        ['menu_bgm', 'bgm', 'bgm_sabara', 'bgm_goiania', 'bgm_russia'].forEach(k => this.stop(k)); 
    }
};

// ================= GERENCIADOR DE ASSETS =================
const Assets = {
    images: {},
    load: function() {
        const names = [
            'capivara','capivara_brasil','capivara_pato','capivara_goiana','capivara_awawa', 
            'sushi','sushi_maki','sushi_ebi','sushi_temaki','pamonha','pao_de_queijo','cachorrao',
            'globe','map','heart','bomb','missile','nuke','shield'
        ];
        names.forEach(n => { this.images[n] = new Image(); this.images[n].src = n + '.png'; });
    },
    
    drawSprite: function(ctx, key, x, y, w, h, facingLeft=false) {
        const img = this.images[key];
        if (config.useImages && img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            if(facingLeft) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); } 
            else { ctx.drawImage(img, x, y, w, h); }
            ctx.restore();
        } else {
            let color = '#FFA500';
            if(key.includes('bomb')||key.includes('missile')) color = '#333';
            ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
        }
    }
};

// ================= GAME ENGINE =================
const Game = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d', {alpha: true}),
    state: 'MENU',
    score: 0, displayScore: 0, lives: 5, frame: 0,
    width: 960, height: 540,
    
    combo: 0, comboTimer: 0, maxCombo: 20, 
    
    items: [], particles: [], texts: [], areaExplosions: [], trail: [],
    
    player: { 
        x: 440, y: 460, w: 80, h: 60, 
        vx: 0, speed: 2.0, friction: 0.85, 
        invuln: 0, sx: 1, sy: 1, hasShield: false,
        dashTimer: 0, dashCooldown: 0, isDashing: false,
        superTimer: 0 
    },

    powerup: { type: null, timer: 0 },
    activeNuke: false,
    skin: 'capivara', bg: 'background', music: 'bgm', awawaCount: 0,
    
    init: function() {
        Assets.load(); AudioSys.load();
        
        this.updateBackground();
        this.startWeatherSystem(); 
        
        window.addEventListener('keydown', e => this.input(e.key, true));
        window.addEventListener('keyup', e => this.input(e.key, false));
        this.canvas.addEventListener('touchstart', e => this.touch(e, true), {passive:false});
        this.canvas.addEventListener('touchend', e => this.touch(e, false));
        
        document.getElementById('fullscreen-btn').onclick = this.toggleFullscreen;
        document.getElementById('pause-btn').onclick = () => this.togglePause();

        this.tryStartMusic();
        document.body.addEventListener('click', () => this.tryStartMusic(), {once:true});

        this.loop();
    },

    tryStartMusic: function() {
        if(this.state === 'MENU' && AudioSys.sounds['menu_bgm'].paused) {
            AudioSys.play('menu_bgm');
        }
    },

    // --- ATUALIZAÇÃO DO CENÁRIO ---
    updateBackground: function() {
        const bgDiv = document.getElementById('game-background');
        if(bgDiv) bgDiv.style.backgroundImage = `url('${this.bg}.png')`;

        // Ativa o Sol apenas em Goiânia
        const sunDiv = document.getElementById('goiania-sun');
        if(this.bg === 'background_goiania') {
            sunDiv.classList.remove('hidden');
        } else {
            sunDiv.classList.add('hidden');
        }
    },
    
    // --- SISTEMA DE CLIMA REFINADO ---
    startWeatherSystem: function() {
        const container = document.getElementById('weather-container');
        
        const createParticle = (instant = false) => {
            const isRussia = (this.bg === 'background_russia');
            const isSunnyMap = (this.bg === 'background_goiania' || this.bg === 'background_sabara');
            
            const p = document.createElement('div');
            
            if(isRussia) {
                // NEVE
                p.className = 'snow';
                const size = 4 + Math.random() * 6; 
                p.style.width = size + 'px'; p.style.height = size + 'px';
                p.style.left = (Math.random() * 100) + '%';
                p.style.top = instant ? (Math.random() * 100) + '%' : '-10px';
                p.style.animationDuration = (2 + Math.random() * 3) + 's'; 
            } else {
                // NUVENS
                p.className = 'cloud';
                const size = 60 + Math.random() * 120;
                p.style.width = size + 'px'; p.style.height = (size * 0.6) + 'px';
                p.style.top = (Math.random() * 40) + '%';
                p.style.opacity = 0.3 + Math.random() * 0.5;
                p.style.animationDuration = (25 + Math.random() * 35) + 's';
                if(instant) { p.style.left = (Math.random() * 100) + '%'; p.style.animationName = 'none'; }
            }
            container.appendChild(p);
            
            if(instant && !isRussia) setTimeout(() => p.remove(), 10000);
            else setTimeout(() => { p.remove(); }, isRussia ? 5000 : 60000);
        };

        // 1. POPULAR CÉU IMEDIATAMENTE (Menos nuvens se for mapa ensolarado)
        let initialClouds = (this.bg === 'background_goiania' || this.bg === 'background_sabara') ? 2 : 6;
        for(let i=0; i<initialClouds; i++) createParticle(true);

        // 2. LOOP INFINITO
        setInterval(() => {
            if(document.hidden) return;
            const isRussia = (this.bg === 'background_russia');
            const isSunnyMap = (this.bg === 'background_goiania' || this.bg === 'background_sabara');

            // Lógica de Frequência:
            // Rússia: Neve cai frequente (60% chance de criar por tick)
            // Goiânia/Sabará: Nuvens raras (15% chance)
            // Outros: Nuvens normais (70% chance de pular -> 30% chance de criar)
            
            if(isRussia) {
                if(Math.random() > 0.6) return; // Neve
            } else if (isSunnyMap) {
                if(Math.random() > 0.15) return; // Muito pouca nuvem
            } else {
                if(Math.random() > 0.3) return; // Normal
            }

            createParticle(false);
        }, 300); 
    },

    keys: {left:false, right:false},
    
    input: function(k, down) {
        if(k==='ArrowLeft'||k==='a') this.keys.left = down;
        if(k==='ArrowRight'||k==='d') this.keys.right = down;
        
        if(down && (k === 'Shift' || k === 'z')) {
            if(this.state === 'PLAYING' && this.player.dashCooldown <= 0) {
                this.player.isDashing = true;
                this.player.dashTimer = 16; 
                this.player.dashCooldown = 50; 
                let dir = 0;
                if(this.keys.right) dir = 1; else if(this.keys.left) dir = -1; else dir = (Math.random() > 0.5 ? 1 : -1); 
                this.player.vx = dir * 45; 
                this.player.sx = 1.6; this.player.sy = 0.4;
                this.spawnParticles(this.player.x + 40, this.player.y + 50, '#00ffff');
            }
        }
        if(down) {
            if(k==='Escape') this.togglePause();
            if(k===' ' && (this.state==='MENU'||this.state==='GAMEOVER')) this.start();
        }
    },
    
    touch: function(e, down) {
        if(e.type!=='touchend') e.preventDefault();
        if(!down) { this.keys.left=false; this.keys.right=false; return; }
        if(this.state !== 'PLAYING') return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const scaleX = this.canvas.width / rect.width; 
        if(x * scaleX < this.width/2) this.keys.left = true; else this.keys.right = true;
    },
    
    toggleFullscreen: function() {
        const b = document.body;
        if(!document.fullscreenElement) { b.requestFullscreen().catch(()=>{}); b.classList.add('fullscreen'); }
        else { document.exitFullscreen(); b.classList.remove('fullscreen'); }
    },

    togglePause: function() {
        if(this.state === 'PLAYING') {
            this.state = 'PAUSED'; 
            UI.show('pause'); 
            AudioSys.sounds[this.music].volume = 0.1; 
        } else if(this.state === 'PAUSED') { this.resume(); }
    },

    resume: function() {
        this.state = 'PLAYING'; 
        UI.show('hud'); 
        AudioSys.stop('menu_bgm'); 
        AudioSys.play(this.music);
        AudioSys.sounds[this.music].volume = 0.4;
    },
    
    start: function() {
        this.reset(); 
        UI.show('hud'); 
        this.state = 'PLAYING';
        AudioSys.stopAllMusic(); 
        AudioSys.play(this.music);
    },
    
    menu: function() {
        this.state = 'MENU'; 
        UI.show('menu'); 
        AudioSys.stopAllMusic();
        AudioSys.play('menu_bgm');
    },
    
    reset: function() {
        this.score = 0; this.displayScore = 0; this.lives = 5; 
        this.combo = 0; this.comboTimer = 0;
        this.items = []; this.particles = []; this.texts = []; this.areaExplosions = []; this.trail = [];
        this.player.x = this.width/2 - this.player.w/2; this.player.vx = 0; this.player.invuln = 0;
        this.player.hasShield = false;
        this.player.dashCooldown = 0;
        this.player.superTimer = 0;
        this.activeNuke = false;
        this.awawaCount = 0;
        
        this.updateBackground();
        
        // Limpa e reinicia clima (respeitando se é ensolarado)
        document.getElementById('weather-container').innerHTML = '';
        const initialClouds = (this.bg === 'background_goiania' || this.bg === 'background_sabara') ? 2 : 6;
        // Precisamos recriar a função createParticle aqui ou chamar startWeatherSystem de novo, 
        // mas como startWeatherSystem roda setInterval, melhor apenas limpar. 
        // O setInterval já existente cuidará de criar novos.
        
        UI.updateHUD(); UI.updateScore(0);
        UI.toggleSuperMode(false);
        document.getElementById('gameCanvas').classList.remove('glitch-effect');
    },
    
    spawn: function() {
        let r = Math.random(), type='sushi';
        if(r<0.4) type='sushi'; else if(r<0.7) type='sushi_maki'; else type='sushi_temaki';
        
        if(Math.random()>0.95) { 
            let p=Math.random(); 
            if(p<0.33) type='globe'; else if(p<0.66) type='map'; else type='shield'; 
        }
        if(Math.random()>0.985) type='heart';
        
        if(Math.random() < 0.08) {
            if(this.bg === 'background_goiania') type = 'pamonha';
            if(this.bg === 'background_sabara') type = 'pao_de_queijo';
            if(this.bg === 'background_brasil') type = 'cachorrao';
        }

        // --- DIFICULDADE (AGRESSIVA) ---
        let difficulty = Math.min(this.score / 5000, 1.0);
        
        // Chance de Bomba: 8% -> 45%
        let bombChance = 0.08 + (difficulty * 0.37);
        
        if(Math.random() < bombChance) {
            type = Math.random()<0.5?'bomb':'missile';
            if(this.score > 100 && !this.activeNuke && Math.random() < 0.05) { 
                type='nuke'; this.activeNuke=true; this.spawnText(this.width/2,200,"☢️ ALERTA!","#FFFF00",35); AudioSys.play('nuke'); 
            }
        }
        
        let s=40; 
        if(['globe','nuke','shield','pamonha','cachorrao','pao_de_queijo'].includes(type)) s=60; 
        if(type==='missile') s=50;
        
        // Velocidade
        let spd = 4 + (Math.random() * 3) + (difficulty * 8); 
        if(type==='missile') spd = 7 + Math.random()*2 + (difficulty * 5); 
        if(['pamonha','pao_de_queijo','cachorrao'].includes(type)) spd=5;

        this.items.push({ 
            x: Math.random()*(this.width-s), y: -s, w: s, h: s, type: type, vy: spd, 
            angle: 0, rot: (type==='missile'||type==='nuke') ? 0 : (Math.random()-0.5)*0.1, 
            osc: Math.random()*Math.PI*2 
        });
    },
    
    update: function() {
        if(this.state !== 'PLAYING') return;
        this.frame++;

        if(this.player.dashCooldown > 0) this.player.dashCooldown--;
        if(this.player.dashTimer > 0) {
            this.player.dashTimer--;
            this.player.vx *= 0.95; 
        } else {
            this.player.isDashing = false;
        }

        if(this.player.superTimer > 0) {
            this.player.superTimer--;
            if(this.frame % 10 === 0) this.spawnParticles(Math.random()*this.width, this.height, `hsl(${Math.random()*360}, 100%, 50%)`);
            if(this.player.superTimer <= 0) { UI.toggleSuperMode(false); this.combo = 0; UI.updateHUD(); }
        }

        if(this.player.superTimer <= 0 && this.combo > 0) {
            this.comboTimer++;
            if(this.comboTimer > 120) { 
                if(this.frame % 10 === 0) { this.combo--; UI.updateHUD(); if(this.combo <= 0) this.comboTimer = 0; }
            }
        }

        if(this.keys.left && !this.player.isDashing) this.player.vx -= this.player.speed;
        if(this.keys.right && !this.player.isDashing) this.player.vx += this.player.speed;
        this.player.vx *= this.player.friction; 
        this.player.x += this.player.vx;
        
        if(this.player.x < 0) { this.player.x = 0; this.player.vx = 0; if(this.player.isDashing) { this.player.isDashing = false; this.player.dashTimer = 0; } } 
        if(this.player.x > this.width - this.player.w) { this.player.x = this.width - this.player.w; this.player.vx = 0; if(this.player.isDashing) { this.player.isDashing = false; this.player.dashTimer = 0; } }
        
        if(this.player.invuln>0) this.player.invuln--;
        this.player.sx += (1 - this.player.sx) * 0.1; this.player.sy += (1 - this.player.sy) * 0.1;

        if(Math.abs(this.player.vx) > 5 || this.player.isDashing || this.player.superTimer > 0) {
            if(this.frame % 3 === 0) {
                this.trail.push({ x: this.player.x, y: this.player.y, w: this.player.w * this.player.sx, h: this.player.h * this.player.sy, alpha: 0.6, facingLeft: this.player.vx < 0, isSuper: this.player.superTimer > 0 });
            }
        }
        for(let i = this.trail.length - 1; i >= 0; i--) {
            this.trail[i].alpha -= 0.05;
            if(this.trail[i].alpha <= 0) this.trail.splice(i, 1);
        }

        let difficulty = Math.min(this.score / 5000, 1.0);
        let rate = Math.floor(35 - (difficulty * 25)); 
        if(rate < 10) rate = 10;
        
        if(this.frame % rate === 0) this.spawn();

        if(this.powerup.timer > 0) {
            this.powerup.timer--;
            if(this.powerup.type === 'globe') this.items.forEach(i => { if(!['bomb','missile','nuke'].includes(i.type)) { i.x += (this.player.x-i.x)*0.08; i.y += (this.player.y-i.y)*0.08; } });
        } else this.powerup.type = null;

        for(let i=this.items.length-1; i>=0; i--) {
            let it = this.items[i]; it.y += it.vy; it.angle += it.rot;
            if(!['missile','nuke','bomb'].includes(it.type)) it.x += Math.sin(this.frame*0.05 + it.osc)*1.5;
            if(this.collide(this.player, it)) { this.hit(it); this.items.splice(i,1); continue; }
            if(it.y > this.height) { if(it.type==='nuke') { this.triggerNuke(it.x); this.activeNuke=false; } this.items.splice(i,1); }
        }

        for(let i=this.areaExplosions.length-1; i>=0; i--) {
            let ex = this.areaExplosions[i]; if(ex.r < ex.maxR) ex.r += 8; ex.life--;
            if(this.player.invuln<=0 && this.player.superTimer <= 0 && this.dist(this.player, ex) < ex.r) { 
                this.takeDamage(1); 
                this.spawnText(this.player.x, this.player.y-60, "RADIAÇÃO!", "#ADFF2F"); 
            }
            if(ex.life<=0) this.areaExplosions.splice(i,1);
        }
        
        this.updateParticles();
        if(this.displayScore < this.score) { let step = Math.ceil((this.score - this.displayScore) * 0.2); this.displayScore += step; UI.updateScore(this.displayScore, true); } else { UI.removePop(); }
        if(this.shake>0) { let dx=(Math.random()-0.5)*this.shake; let dy=(Math.random()-0.5)*this.shake; this.canvas.style.transform = `translate(${dx}px, ${dy}px)`; this.shake--; } else { this.canvas.style.transform='none'; }
        if(this.lives <= 0) this.gameOver();
    },
    
    hit: function(it) {
        if(['bomb','missile','nuke'].includes(it.type)) {
            if(this.player.superTimer > 0) {
                this.createExplosion(it.x, it.y, '#FFD700'); AudioSys.play('boom'); this.score += 50; this.spawnText(it.x, it.y, "SMASH!", "#fff", 30); this.shake = 10; return;
            }
            if(this.player.invuln > 0) return;
            if(this.player.hasShield && it.type!=='nuke') {
                this.player.hasShield=false; this.player.invuln=40; AudioSys.play('shield_break'); UI.flash('blue'); this.spawnText(this.player.x, this.player.y, "BLOQUEADO!", "#00BFFF", 25); return;
            }
            document.getElementById('gameCanvas').classList.add('glitch-effect');
            setTimeout(() => document.getElementById('gameCanvas').classList.remove('glitch-effect'), 400);
            this.player.sy=0.6; this.player.sx=1.4;
            if(it.type==='nuke') { this.triggerNuke(it.x); this.activeNuke=false; this.lives-=2; }
            else { this.takeDamage(1); this.createExplosion(it.x,it.y,'#555'); AudioSys.play('boom'); UI.flash('red'); }
            UI.updateLives(this.lives);
        } else if(it.type === 'heart') {
            if(this.lives<5) this.lives++; AudioSys.play('heal'); UI.updateLives(this.lives); UI.flash('green'); this.spawnText(this.player.x, this.player.y, "+1 VIDA", "#ff0000", 30);
        } else if(it.type === 'shield') {
            this.player.hasShield=true; AudioSys.play('shield_up'); UI.flash('blue'); this.spawnText(this.player.x, this.player.y, "ESCUDO!", "#00BFFF", 30);
        } else {
            let pts=1;
            if(it.type.includes('maki')) pts=2; if(it.type.includes('temaki')) pts=5;
            if(['pamonha','pao_de_queijo','cachorrao'].includes(it.type)) pts=100;
            if(it.type==='map') { pts=20; this.powerup={type:'map',timer:400}; AudioSys.play('power'); }
            if(it.type==='globe') { pts=50; this.powerup={type:'globe',timer:400}; AudioSys.play('power'); }
            if(this.powerup.type==='map') pts*=2;
            if(this.player.superTimer <= 0) { this.combo++; this.comboTimer = 0; }
            if(this.combo >= this.maxCombo && this.player.superTimer <= 0) { this.triggerSuperMode(); }
            
            // SOM DE COLETA (Pamonha/Pão ou Genérico)
            let eatSound = 'eat';
            if(it.type === 'pamonha') eatSound = 'pamonha';
            else if(it.type === 'pao_de_queijo') eatSound = 'pao_de_queijo';
            
            // Ajusta pitch pelo combo apenas se for som genérico
            let pitch = (eatSound === 'eat') ? 1.0 + Math.min(this.combo*0.05, 0.5) : 1.0;
            AudioSys.play(eatSound, pitch);
            
            this.score+=pts; 
            if(this.skin === 'capivara_awawa') { this.awawaCount++; if(this.awawaCount>=10) { AudioSys.play('awawa'); this.awawaCount=0; } }
            
            let col = pts>=100?'#FFD700':(pts>10?'#FFD700':'#FFF');
            let msg = `+${pts}`;
            if(it.type==='pamonha') msg="PAMONHA!"; if(it.type==='pao_de_queijo') msg="PÃO DE QUEIJO!"; if(it.type==='cachorrao') msg="CACHORRÃO!";
            this.spawnParticles(it.x, it.y, col); this.spawnText(this.player.x, this.player.y, msg, col, pts>=100?30:20);
            this.player.sy=0.7; this.player.sx=1.3; UI.updateHUD();
        }
    },
    
    triggerSuperMode: function() {
        this.player.superTimer = 300; this.combo = this.maxCombo; AudioSys.play('super_start');
        UI.toggleSuperMode(true); this.spawnText(this.width/2, this.height/2, "SUPER MODE!", "#FF00FF", 50); UI.flash('rainbow');
    },

    takeDamage: function(qtd) { this.lives-=qtd; this.combo=0; this.player.invuln=60; this.shake=20; UI.updateHUD(); AudioSys.play('hurt'); },
    triggerNuke: function(x) { UI.flash('white'); AudioSys.play('boom'); this.items=[]; this.activeNuke=false; this.areaExplosions.push({x:x, y:this.height-20, r:10, maxR:350, life:120}); },
    collide: function(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
    dist: function(p, ex) { let dx=(p.x+p.w/2)-ex.x; let dy=(p.y+p.h/2)-ex.y; return Math.sqrt(dx*dx + dy*dy); },
    createExplosion: function(x, y, color) { for(let i=0; i<12; i++) this.particles.push({x:x, y:y, vx:(Math.random()-0.5)*12, vy:(Math.random()-0.5)*12, life:1, color:color}); },
    spawnParticles: function(x, y, color) { for(let i=0; i<8; i++) this.particles.push({x:x, y:y, vx:(Math.random()-0.5)*10, vy:(Math.random()-0.5)*10, life:1, color:color}); },
    spawnText: function(x, y, txt, color, size=20) { this.texts.push({x,y,txt,color,size,life:60}); },
    
    updateParticles: function() {
        if(this.particles.length > 80) this.particles.splice(0, 10);
        for(let i=this.particles.length-1; i>=0; i--) { let p=this.particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.5; p.life-=0.05; if(p.life<=0) this.particles.splice(i,1); }
        for(let i=this.texts.length-1; i>=0; i--) { let t=this.texts[i]; t.y-=2; t.life--; if(t.life<=0) this.texts.splice(i,1); }
    },

    draw: function() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.areaExplosions.forEach(ex => {
            let g=this.ctx.createRadialGradient(ex.x,ex.y,0,ex.x,ex.y,ex.r); g.addColorStop(0,'rgba(255,200,0,0.8)'); g.addColorStop(1,'rgba(255,0,0,0)');
            this.ctx.fillStyle=g; this.ctx.beginPath(); this.ctx.arc(ex.x,ex.y,ex.r,Math.PI,0); this.ctx.fill();
        });
        this.trail.forEach(t => {
            this.ctx.save(); this.ctx.globalAlpha = t.alpha;
            if(t.isSuper) this.ctx.filter = `hue-rotate(${Math.random()*360}deg) brightness(2)`;
            Assets.drawSprite(this.ctx, this.skin, t.x, t.y, t.w, t.h, t.facingLeft);
            this.ctx.filter = 'none'; this.ctx.restore();
        });
        if(this.player.invuln%10 < 5 || this.player.superTimer > 0) {
            let w=this.player.w*this.player.sx, h=this.player.h*this.player.sy;
            let x=this.player.x+(this.player.w-w)/2, y=this.player.y+(this.player.h-h);
            if(this.player.superTimer > 0) { this.ctx.save(); this.ctx.filter = `drop-shadow(0 0 10px #FF00FF) brightness(1.2)`; }
            Assets.drawSprite(this.ctx, this.skin, x, y, w, h, this.player.vx<0);
            if(this.player.superTimer > 0) this.ctx.restore();
        }
        if(this.player.hasShield) {
            this.ctx.save(); this.ctx.translate(this.player.x+40, this.player.y+30);
            let s=1+Math.sin(this.frame*0.1)*0.05; this.ctx.scale(s,s);
            this.ctx.strokeStyle='#00BFFF'; this.ctx.lineWidth=4; this.ctx.shadowBlur=15; this.ctx.shadowColor='#00BFFF';
            this.ctx.beginPath(); this.ctx.arc(0,0,55,0,Math.PI*2); this.ctx.stroke(); this.ctx.restore();
        }
        if(this.powerup.type) {
            let pulse=Math.sin(this.frame*0.2)*5; this.ctx.save(); this.ctx.translate(this.player.x+40, this.player.y+30);
            this.ctx.strokeStyle=this.powerup.type==='globe'?'#00ccff':'#8bc34a'; this.ctx.lineWidth=4;
            this.ctx.beginPath(); this.ctx.arc(0,0,65+pulse,0,Math.PI*2); this.ctx.stroke(); this.ctx.restore();
        }
        this.items.forEach(it => { Assets.drawSprite(this.ctx, it.type, it.x, it.y, it.w, it.h); });
        this.particles.forEach(p => { this.ctx.globalAlpha=p.life; this.ctx.fillStyle=p.color; this.ctx.beginPath(); this.ctx.arc(p.x,p.y,4,0,Math.PI*2); this.ctx.fill(); this.ctx.globalAlpha=1; });
        this.texts.forEach(t => { this.ctx.fillStyle=t.color; this.ctx.strokeStyle='black'; this.ctx.lineWidth=3; this.ctx.font=`900 ${t.size}px Arial`; this.ctx.strokeText(t.txt,t.x,t.y); this.ctx.fillText(t.txt,t.x,t.y); });
    },
    
    loop: function() {
        if(this.state === 'PLAYING') this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    gameOver: function() {
        try {
            this.state='GAMEOVER'; document.getElementById('final-score').innerText=this.score;
            try { if(this.score>highScore) { highScore=this.score; localStorage.setItem('capyHighScore', highScore); } } catch(e){}
            document.getElementById('record-score').innerText=highScore;
            UI.show('gameover'); 
            AudioSys.stopAllMusic(); AudioSys.play('over');
            UI.toggleSuperMode(false); 
        } catch(e) { console.error(e); UI.show('gameover'); }
    }
};

const UI = {
    show: function(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('hud-layer').style.display = 'none';
        if(screen === 'menu') document.getElementById('menu-screen').classList.remove('hidden');
        if(screen === 'gameover') document.getElementById('gameover-screen').classList.remove('hidden');
        if(screen === 'pause') document.getElementById('pause-screen').classList.remove('hidden');
        if(screen === 'hud') document.getElementById('hud-layer').style.display = 'flex';
    },
    updateScore: function(val, pop=false) {
        const el = document.getElementById('score-display');
        el.innerText = val;
        if(pop) { el.classList.remove('pop-score'); void el.offsetWidth; el.classList.add('pop-score'); }
    },
    removePop: function() { document.getElementById('score-display').classList.remove('pop-score'); },
    updateLives: function(val) {
        const container = document.getElementById('lives-display'); container.innerHTML = '';
        for(let i=0; i<5; i++) {
            const heart = document.createElement('span'); heart.className = 'heart-icon'; heart.innerText = '❤️';
            if(i >= val) heart.classList.add('heart-lost'); container.appendChild(heart);
        }
    },
    updateHUD: function() {
        this.updateLives(Game.lives);
        let pct = Math.min((Game.combo / Game.maxCombo) * 100, 100);
        document.getElementById('combo-bar').style.width = pct + '%';
        const txt = document.getElementById('combo-text'); const container = document.getElementById('combo-container');
        if(pct >= 100) { container.style.borderColor = '#00ff00'; txt.innerText = "SUPER MODE ATIVO!"; txt.style.opacity = 1; } 
        else { container.style.borderColor = '#fff'; txt.innerText = `COMBO X${Game.combo}!`; txt.style.opacity = Game.combo > 2 ? 1 : 0; }
    },
    toggleSuperMode: function(active) {
        const wrapper = document.getElementById('game-wrapper'); const msg = document.getElementById('super-mode-msg');
        if(active) { wrapper.classList.add('super-active'); msg.classList.remove('hidden'); } 
        else { wrapper.classList.remove('super-active'); msg.classList.add('hidden'); }
    },
    flash: function(type) {
        const fx = document.getElementById('fx-overlay'); fx.className = ''; void fx.offsetWidth; 
        if(type==='red') fx.className='flash-red'; if(type==='green') fx.className='flash-green';
        if(type==='blue') fx.className='flash-blue'; if(type==='white') fx.className='flash-white';
        if(type==='rainbow') fx.className='flash-rainbow';
        setTimeout(() => fx.className = '', type==='rainbow'?1000:300);
    },
    openModal: function(type) {
        const grid = document.getElementById('options-container'); const title = document.getElementById('modal-title');
        grid.innerHTML = ''; document.getElementById('modal-screen').classList.remove('hidden');
        if(type === 'skins') {
            title.innerText = "ESCOLHA A SKIN";
            this.addOpt(grid, 'Terno', 'capivara', true); this.addOpt(grid, 'Brasil', 'capivara_brasil', true);
            this.addOpt(grid, 'Pato', 'capivara_pato', true); this.addOpt(grid, 'Goiana', 'capivara_goiana', true); this.addOpt(grid, 'Awawa', 'capivara_awawa', true);
        } else {
            title.innerText = "ESCOLHA O MAPA";
            this.addOpt(grid, 'Céu Azul', 'background', false); this.addOpt(grid, 'Maringá-PR', 'background_brasil', false);
            this.addOpt(grid, 'Sabará-MG', 'background_sabara', false); this.addOpt(grid, 'Goiânia-GO', 'background_goiania', false); this.addOpt(grid, 'Rússia', 'background_russia', false);
        }
    },
    addOpt: function(parent, name, key, isSkin) {
        const div = document.createElement('div');
        div.className = 'option-card ' + (isSkin ? (Game.skin===key?'selected':'') : (Game.bg===key?'selected':''));
        div.innerHTML = `<img src="${key}.png" class="option-preview" onerror="this.style.display='none'"><div class="option-name">${name}</div>`;
        div.onclick = () => {
            if(isSkin) Game.skin = key;
            else { 
                Game.bg = key; 
                Game.music = (key==='background_sabara') ? 'bgm_sabara' : (key==='background_goiania') ? 'bgm_goiania' : (key==='background_russia') ? 'bgm_russia' : 'bgm';
                Game.updateBackground(); document.getElementById('weather-container').innerHTML = '';
            }
            AudioSys.play('hud_select'); this.closeModal();
        };
        parent.appendChild(div);
    },
    closeModal: function() { document.getElementById('modal-screen').classList.add('hidden'); }
};

let highScore = 0; try { highScore = localStorage.getItem('capyHighScore') || 0; } catch(e) {}
document.getElementById('high-score-display').innerText = `RECORDE: ${highScore}`;
Game.init();