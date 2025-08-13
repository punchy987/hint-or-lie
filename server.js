// ===== HINT OR LIE — SERVEUR SOCKET.IO =====

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// === Statique ===
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ===== CONFIG — DURÉES (secondes) =====
const HINT_SECONDS = 45;         // phase "indices"
const VOTE_SECONDS = 40;         // phase "vote"
const LOBBY_READY_SECONDS = 10;  // décompte quand tout le monde est prêt dans le salon

// ===== ÉTAT =====
const rooms = new Map();

// Codes de salle : 4 chiffres
const CODE_CHARS = '0123456789';
const CODE_LENGTH = 4;
const genCode = () => Array.from({ length: CODE_LENGTH }, () =>
  CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
).join('');

// petit util
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- Listes grand public (UTF-8) ---
const DOMAINS = {
  "Fruits Fleurs Légumes": [
    "Mangue","Papaye","Ananas","Banane","Pomme","Poire","Raisin","Myrtille",
    "Pastèque","Melon","Citron","Orange","Kiwi","Fraise","Coco","Concombre",
    "Tomate","Poivron","Oignons","Hibiscus","Tipanier","Rose","Corossol",
    "Laitue","Carotte","Aubergine","Courgette","Basilic"
  ],
  "Animaux": [
    "Chat","Chien","Tortue","Kangourou","Dauphin","Requin","Panda","Koala","Tigre",
    "Lion","Perroquet","Toucan","Cheval","Zèbre","Aigle","Faucon","Loutre","Castor",
    "Grenouille","Serpent","Souris"
  ],
  "Villes": [
    "Paris","Londres","Tokyo","Osaka","New York","Los Angeles","Rome","Athènes",
    "Madrid","Barcelone","Berlin","Munich","Rio","Sao Paulo","Sydney","Melbourne",
    "Montréal","Toronto","Le Caire","Alexandrie","Dubaï","Abu Dhabi","Manchester"
  ],
  "Pays": [
    "France","Japon","Brésil","Canada","Égypte","Italie","Espagne","Allemagne",
    "Australie","Maroc","Mexique","USA","Chine","Inde","Royaume-Uni"
  ],
  "Sports": [
    "Football","Rugby","Tennis","Badminton","Basket","Handball","Boxe","Arts Martiaux",
    "Formule 1","Rallye","Surf","Voile","Cyclisme","VTT","Ski","Snowboard","Golf",
    "Cricket","Danse"
  ],
  "Objets": [
    "Chaise","Tabouret","Table","Bureau","Téléphone","Tablette","Ordinateur","Console",
    "Clé","Serrure","Lampe","Bougie","Valise","Sac à Dos","Montre","Bracelet","Lunettes",
    "Casque","Stylo","Crayon","Tasse","Verre","Ciseaux","Cutter"
  ],
  "Nature": [
    "Plage","Montagne","Forêt","Désert","Lac","Rivière","Île","Continent","Volcan",
    "Glacier","Cascade","Geyser","Ciel","Océan","Soleil","Lune"
  ],
  "Métiers": [
    "Médecin","Infirmier","Professeur","Étudiant","Pompier","Policier","Cuisinier",
    "Serveur","Pilote","Hôtesse de l'Air","Architecte","Ingénieur"
  ],
  "Transports": [
    "Voiture","Moto","Bus","Tram","Train","Métro","Avion","Hélicoptère","Bateau",
    "Ferry","Vélo","Trottinette"
  ],
  "Couleurs Formes": [
    "Rouge","Orange","Bleu","Cyan","Vert","Lime","Noir","Gris","Blanc","Ivoire",
    "Cercle","Ellipse","Carré","Rectangle","Triangle","Pyramide"
  ],
  "Cinéma": [
    "Star Wars","Harry Potter","Le Seigneur des Anneaux","Marvel","DC Comics","Batman",
    "Superman","Iron Man","Captain America","Avengers","Black Panther","Doctor Strange",
    "Spider-Man","Hulk","Joker","Wonder Woman","Aquaman","The Flash","Avatar","Titanic",
    "Jurassic Park","Jurassic World","Indiana Jones","Matrix","Inception","Interstellar",
    "Le Roi Lion","La Reine des Neiges","Toy Story","Cars","Coco","Vice-Versa","Les Indestructibles"
  ],
  "Manga": [
    "Naruto","One Piece","Dragon Ball","Bleach","Pokémon","My Hero Academia","Attack on Titan",
    "Death Note","Fullmetal Alchemist","One Punch Man","Demon Slayer","Jujutsu Kaisen",
    "Hunter x Hunter","Fairy Tail","Black Clover","Chainsaw Man"
  ],
  "Personnalités": [
    "Beyonce","Rihanna","Cristiano Ronaldo","Lionel Messi","Taylor Swift","Ariana Grande",
    "Keanu Reeves","Tom Cruise","Elon Musk","Jeff Bezos","Drake","The Weeknd","Shakira",
    "Eminem","Adele","Lady Gaga","Robert Downey Jr.","Chris Hemsworth","Scarlett Johansson",
    "Zendaya","Dwayne Johnson","Jason Momoa","Serena Williams","Roger Federer","Michael Jordan",
    "Usain Bolt","Lewis Hamilton"
  ],
  "Marques": [
    "Apple","Samsung","Xiaomi","Sony","Dell","HP","JBL","Lenovo","BMW","Mercedes","Audi",
    "Tesla","Toyota","Honda","Peugeot","Renault","Ford","Ferrari","Lamborghini","Adidas",
    "Nike","Puma","Reebok","Lacoste","Coca-Cola","Pepsi","Nestlé","Red Bull","Starbucks",
    "Nutella","McDonalds","Burger King","KFC"
  ]
};

// ===== UTILS (texte) =====
const deburr = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const normalize = (s='') => deburr(String(s).toLowerCase()).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
function levenshtein(a,b){
  a = normalize(a); b = normalize(b);
  const m=a.length, n=b.length; if(!m) return n; if(!n) return m;
  const dp = Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[i-1]?0:1));
  return dp[m][n];
}

// ===== Validation d'indice (anti-révélation) =====
function isHintAllowed(secretWord, hint, domain){
  const h = normalize(hint);
  const w = normalize(secretWord);
  if (!h) return { ok:false, reason:"Indice vide." };

  const plurals = new Set([w, w+'s', w+'es']);
  if (plurals.has(h)) return { ok:false, reason:"Indice identique au mot." };

  const wordsInHint = new Set(h.split(' '));
  if (wordsInHint.has(w) || wordsInHint.has(w+'s') || wordsInHint.has(w+'es'))
    return { ok:false, reason:"Tu as utilisé le mot lui-même." };

  if (h.includes(w) && w.length>=4) return { ok:false, reason:"Indice trop proche du mot." };
  if (w.length>=5 && levenshtein(w,h) <= 2) return { ok:false, reason:"Indice presque identique." };

  // Interdiction des mots du thème
  const dom = normalize(domain||'');
  const domTokens = dom.split(' ').filter(Boolean);
  const banned = new Set();
  for (const t of domTokens){
    banned.add(t);
    if (t.endsWith('es')) banned.add(t.slice(0,-2));
    if (t.endsWith('s'))  banned.add(t.slice(0,-1));
  }
  if (banned.has(h)) return { ok:false, reason:"N’utilise pas le nom du thème." };
  for (const token of wordsInHint){
    if (banned.has(token)) return { ok:false, reason:"Indice trop proche du thème." };
  }
  return { ok:true };
}

// ===== Tirage "anti-répétitions" =====
function pickPairFromDomainsUnique(room) {
  room.used ||= {};
  room.lastDomains ||= [];
  const cooldown = room.domainCooldown ?? 1;

  const all = Object.keys(DOMAINS);
  const validDomains = all.filter(d => (DOMAINS[d]?.length || 0) >= 2);
  if (validDomains.length === 0) {
    return { common: 'Erreur', impostor: 'Erreur', domain: 'Aucun domaine' };
  }

  const banned = new Set(room.lastDomains.slice(-cooldown));
  const candidates = validDomains.filter(d => !banned.has(d));

  const domain = (candidates.length ? pick(candidates) : pick(validDomains));
  const pool = DOMAINS[domain].slice();

  let usedSet = room.used[domain];
  if (!usedSet) usedSet = room.used[domain] = new Set();

  let available = pool.filter(w => !usedSet.has(w));
  if (available.length < 2) {
    usedSet = room.used[domain] = new Set();
    available = pool.slice();
  }

  let common = pick(available);
  if (available.length > 1) {
    let guard = 0;
    while (common === room.lastCommon && guard++ < 10) common = pick(available);
  }
  available = available.filter(w => w !== common);
  const impostor = pick(available);

  usedSet.add(common);
  usedSet.add(impostor);

  room.lastCommon = common;
  room.lastDomains.push(domain);
  if (room.lastDomains.length > 5) room.lastDomains.shift();

  return { common, impostor, domain };
}

// ===== TIMERS =====
function clearRoomTimer(room){
  if (room?.timer?.interval) clearInterval(room.timer.interval);
  if (room) room.timer = { interval:null, deadline:0, phase:null };
}
function startPhaseTimer(code, seconds, phase, onExpire){
  const room = rooms.get(code); if(!room) return;
  clearRoomTimer(room);
  const deadline = Date.now() + seconds*1000;
  room.timer = { interval:null, deadline, phase };
  room.timer.interval = setInterval(()=>{
    const leftMs = Math.max(0, deadline - Date.now());
    io.to(code).emit('timer', { phase, leftMs });
    if (leftMs <= 0){ clearRoomTimer(room); onExpire?.(); }
  }, 500);
}

// ===== HELPERS ROOMS =====
function createRoom(hostId, hostName){
  let code; do { code = genCode(); } while (rooms.has(code));
  const r = {
    hostId, state:'lobby', round:0, words:null,
    players:new Map(), lastDomain:null, lastCommon:null,
    timer:{ interval:null, deadline:0, phase:null },
    lobbyReady: new Set(),
    used: {}
  };
  r.players.set(hostId, { name:hostName, hint:null, vote:null, isImpostor:false, score:0 });
  rooms.set(code, r);
  return code;
}
function snapshot(code){
  const r = rooms.get(code); if(!r) return null;
  const players = Array.from(r.players.entries()).map(([id,p])=>({id,name:p.name,score:p.score}));
  return { code, state:r.state, round:r.round, players };
}
function broadcast(code){ const s = snapshot(code); if (s) io.to(code).emit('roomUpdate', s); }

// ===== FLOW DE MANCHE =====
function startRound(code){
  const r = rooms.get(code); if(!r) return;
  clearRoomTimer(r);
  r.lobbyReady = new Set();
  r.readyNext = new Set();

  const ids = Array.from(r.players.keys());
  if (ids.length < 3){ io.to(code).emit('errorMsg','Minimum 3 joueurs'); r.state='lobby'; broadcast(code); return; }

  for (const p of r.players.values()){ p.hint=null; p.vote=null; p.isImpostor=false; }

  const pair = pickPairFromDomainsUnique(r);
  r.lastDomain = pair.domain; r.lastCommon = pair.common;

  const impId = pick(ids);
  r.words = { common:pair.common, impostor:pair.impostor, domain:pair.domain };
  r.round += 1; r.state='hints';

  for (const [id,p] of r.players.entries()){
    p.isImpostor = (id === impId);
    io.to(id).emit('roundInfo', {
      word: p.isImpostor ? r.words.impostor : r.words.common,
      isImpostor: p.isImpostor,
      domain: r.words.domain
    });
  }

  io.to(code).emit('phaseProgress', { phase:'hints', submitted:0, total:ids.length });

  startPhaseTimer(code, HINT_SECONDS, 'hints', ()=>{
    const room = rooms.get(code); if(!room) return;
    for (const p of room.players.values()) if (typeof p.hint !== 'string') p.hint = '';
    maybeStartVoting(code);
  });

  broadcast(code);
}
function maybeStartVoting(code){
  const r = rooms.get(code); if(!r || r.state!=='hints') return;
  const ok = Array.from(r.players.values()).every(p => typeof p.hint === 'string');
  if (!ok) return;

  r.state='voting';
  const hints = Array.from(r.players.entries()).map(([id,p])=>({id,name:p.name,hint:p.hint||''}));
  io.to(code).emit('allHints', { hints, domain:r.words?.domain || null });
  io.to(code).emit('phaseProgress', { phase:'voting', submitted:0, total: r.players.size });

  startPhaseTimer(code, VOTE_SECONDS, 'voting', ()=>{
    const room = rooms.get(code); if (!room) return;
    for (const [id,p] of room.players.entries()) if (!p.vote) p.vote = id; // auto-vote pour soi
    finishVoting(code);
  });

  broadcast(code);
}
function finishVoting(code){
  const r = rooms.get(code);
  if (!r || r.state !== 'voting') return;

  const allVoted = Array.from(r.players.values()).every(p => p.vote);
  if (!allVoted) return;

  clearRoomTimer(r);

  let impId = null;
  for (const [id,p] of r.players.entries()) if (p.isImpostor) impId = id;

  const tally = {};
  for (const p of r.players.values()) tally[p.vote] = (tally[p.vote] || 0) + 1;

  let top = null, max = -1;
  for (const [c,v] of Object.entries(tally)) if (v > max) { max = v; top = c; }

  const caught = (top === impId);

  if (caught) {
    for (const p of r.players.values()) if (!p.isImpostor) p.score += 1;
  } else {
    const imp = r.players.get(impId); if (imp) imp.score += 2;
  }

  r.state = 'reveal';
  io.to(code).emit('roundResult', {
    impostorId: impId,
    impostorName: r.players.get(impId)?.name,
    common: r.words.common,
    impostor: r.words.impostor,
    votes: tally,
    impostorCaught: caught,
    domain: r.words.domain
  });

  r.readyNext = new Set();
  io.to(code).emit('readyProgress', { ready: 0, total: r.players.size });

  broadcast(code);

  const arr = Array.from(r.players.values());
  const maxScore = Math.max(...arr.map(p => p.score));
  if (maxScore >= 10){
    const winners = Array.from(r.players.entries())
      .filter(([_,p]) => p.score === maxScore)
      .map(([id,p]) => ({ id, name:p.name, score:p.score }));
    for (const p of r.players.values()) p.score = 0;
    r.round = 0;
    r.state = 'lobby';
    io.to(code).emit('gameOver', { winners, autoReset: true });
    broadcast(code);
  }
}

// ===== SOCKETS =====
io.on('connection',(socket)=>{
  console.log('[server] client connected', socket.id);
  let joined = { code:null };

  // ——— CRÉER ———
  socket.on('createRoom', ({name})=>{
    const code = createRoom(socket.id, String(name||'Joueur').slice(0,16));
    socket.join(code); joined.code=code;
    socket.emit('roomCreated',{code});
    broadcast(code);
  });

  // ——— REJOINDRE ———
  socket.on('joinRoom', ({ code, name })=>{
    code = String(code||'').trim();
    if (!/^\d{4}$/.test(code)) return socket.emit('errorMsg','Code invalide (4 chiffres)');
    const r = rooms.get(code); if(!r) return socket.emit('errorMsg','Salle introuvable');

    socket.join(code); joined.code = code;
    r.players.set(socket.id, { name:String(name||'Joueur').slice(0,16), hint:null, vote:null, isImpostor:false, score:0 });

    // si décompte lobby en cours, on annule
    if (r.state === 'lobby' && r.timer?.phase === 'lobby') {
      clearRoomTimer(r);
      r.lobbyReady = new Set();
      io.to(code).emit('lobbyCountdownCancelled');
      io.to(code).emit('lobbyReadyProgress', { ready: 0, total: r.players.size });
    }

    socket.emit('roomJoined',{code});
    broadcast(code);
  });

  // ——— PRÊT AU SALON ———
  socket.on('playerReadyLobby', ({ ready })=>{
    const r = rooms.get(joined.code); if(!r) return;
    if (r.state !== 'lobby') return;

    if (ready) r.lobbyReady.add(socket.id);
    else r.lobbyReady.delete(socket.id);

    io.to(joined.code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });

    if (r.lobbyReady.size === r.players.size && r.players.size >= 3) {
      clearRoomTimer(r);
      startPhaseTimer(joined.code, LOBBY_READY_SECONDS, 'lobby', ()=> startRound(joined.code));
      io.to(joined.code).emit('lobbyCountdownStarted', { seconds: LOBBY_READY_SECONDS });
    } else if (r.timer?.phase === 'lobby') {
      clearRoomTimer(r);
      io.to(joined.code).emit('lobbyCountdownCancelled');
    }
  });

  // ——— DÉMARRER (option hôte) ———
  socket.on('startRound', ()=>{
    const r = rooms.get(joined.code); if(!r) return;
    if (r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut démarrer");
    startRound(joined.code);
    socket.emit('actionAck', { action:'startRound', status:'ok' });
  });

  // ——— INDICE ———
  socket.on('submitHint', ({hint})=>{
    const r = rooms.get(joined.code); if(!r || r.state!=='hints') return;
    const p = r.players.get(socket.id); if(!p) return;
    if (typeof p.hint === 'string') return; // anti double
    const raw = String(hint||'').trim().slice(0,40);

    const mySecret = p.isImpostor ? r.words.impostor : r.words.common;
    const check = isHintAllowed(mySecret, raw, r.words.domain);
    if (!check.ok){ socket.emit('hintRejected', { reason: check.reason }); return; }

    p.hint = raw;
    socket.emit('hintAck');
    const submitted = Array.from(r.players.values()).filter(x => typeof x.hint === 'string').length;
    io.to(joined.code).emit('phaseProgress', { phase:'hints', submitted, total: r.players.size });

    maybeStartVoting(joined.code);
    broadcast(joined.code);
  });

  // ——— VOTE ———
  socket.on('submitVote', ({targetId})=>{
    const r = rooms.get(joined.code); if(!r || r.state!=='voting') return;
    if(!r.players.has(targetId)) return;
    const p = r.players.get(socket.id); if(!p) return;
    const firstTime = !p.vote; // au cas où tu veux le compter séparément un jour
    p.vote = targetId;

    socket.emit('voteAck');
    const submitted = Array.from(r.players.values()).filter(x => !!x.vote).length;
    io.to(joined.code).emit('phaseProgress', { phase:'voting', submitted, total: r.players.size });

    finishVoting(joined.code);
    broadcast(joined.code);
  });

  // ——— PRÊT ENTRE MANCHES ———
  socket.on('playerReadyNext', ()=>{
    const r = rooms.get(joined.code); if(!r) return;
    if (r.state !== 'reveal') return;

    if (!r.readyNext) r.readyNext = new Set();
    r.readyNext.add(socket.id);
    io.to(joined.code).emit('readyProgress', { ready: r.readyNext.size, total: r.players.size });

    if (r.readyNext.size === r.players.size) {
      startPhaseTimer(joined.code, 3, 'prestart', ()=> startRound(joined.code));
    }
  });

  // ——— RESET SCORES ———
  socket.on('resetScores', ()=>{
    const r = rooms.get(joined.code); if(!r) return;
    if (r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut réinitialiser");
    for (const p of r.players.values()) p.score = 0;
    r.round = 0; r.state = 'lobby';
    r.used = {};
    r.lobbyReady = new Set();
    clearRoomTimer(r);
    io.to(joined.code).emit('lobbyCountdownCancelled');
    io.to(joined.code).emit('scoresReset');
    broadcast(joined.code);
  });

  // ——— DÉCONNEXION ———
  socket.on('disconnect',()=>{
    const code = joined.code; if(!code) return;
    const r = rooms.get(code); if(!r) return;
    r.players.delete(socket.id);

    if (r.lobbyReady?.has(socket.id)) {
      r.lobbyReady.delete(socket.id);
      io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });
      if (r.timer?.phase === 'lobby') {
        clearRoomTimer(r);
        io.to(code).emit('lobbyCountdownCancelled');
      }
    }
    if (r.readyNext?.has(socket.id)){
      r.readyNext.delete(socket.id);
      io.to(code).emit('readyProgress', { ready: r.readyNext.size, total: r.players.size });
    }

    if (r.hostId === socket.id){
      const first = r.players.keys().next().value;
      if (first) r.hostId = first; else rooms.delete(code);
    }
    broadcast(code);
  });
});

// ===== START =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('Hint or Lie — port', PORT));
