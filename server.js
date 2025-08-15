// ===== HINT OR LIE — SERVEUR SOCKET.IO =====

// ===== HINT OR LIE — SERVEUR SOCKET.IO =====
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// 1) Créer l'app Express
const app = express();

// 2) Servir le dossier public
app.use(express.static(path.join(__dirname, 'public')));

// 3) Route racine -> index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// (Optionnel : fallback SPA si tu veux que toute route renvoie index.html)
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// 4) Créer le serveur HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// === Firestore (server-side, optional) ===
let db = null;
try {
  const admin = require('firebase-admin');

  // ✅ N'activer Firestore que si la clé est fournie
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    }
    db = admin.firestore();
    var _admin = admin;
    console.log('[server] Firebase enabled');
  } else {
    console.log('[server] Firebase disabled (no FIREBASE_SERVICE_ACCOUNT)');
  }
} catch (e) {
  console.log('[server] Firebase SDK not installed (optional)');
}
// RP ranked : +3 imposteur gagnant, +1 équipier gagnant, -1 défaite
// Plancher Bronze : si RP courant < 10, on ne descend jamais sous 0
async function upsertRoundResult({ deviceId, pseudo, didWin, isImpostor }) {
  try{
    if (!db || !deviceId) return;
    const ref = db.collection('players').doc(String(deviceId));

    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(ref);
      const prev = snap.exists ? (snap.data() || {}) : {};

      const prevRP    = Number(prev.rp || 0);
      const rpDelta   = didWin ? (isImpostor ? 3 : 1) : -1;     // <-- barème RP
      const winsDelta = didWin ? 1 : 0;

      let newRP = prevRP + rpDelta;
      if (prevRP < 10 && newRP < 0) newRP = 0;                  // <-- plancher Bronze

      tx.set(ref, {
        deviceId: String(deviceId),
        lastPseudo: String(pseudo || prev.lastPseudo || 'Joueur').slice(0,16),

        rounds: Number(prev.rounds || 0) + 1,
        wins: Number(prev.wins || 0) + winsDelta,
        winsCrew: Number(prev.winsCrew || 0) + (didWin && !isImpostor ? 1 : 0),
        winsImpostor: Number(prev.winsImpostor || 0) + (didWin && isImpostor ? 1 : 0),

        rp: newRP,
        updatedAt: _admin ? _admin.firestore.FieldValue.serverTimestamp() : new Date()
      }, { merge:true });
    });
  }catch(e){
    console.error('upsertRoundResult error', e.message);
  }
}



async function getTop50(){
  try{
    if (!db) return [];
    const qs = await db.collection('players')
      .orderBy('rp','desc')    // <-- RP d’abord
      .orderBy('wins','desc')  // puis victoires
      .limit(50).get();
    return qs.docs.map(d => ({ deviceId:d.id, ...(d.data()||{}) }));
  }catch(e){ console.error('getTop50 error', e.message); return []; }
}
async function getMyStats(deviceId){
  if (!db || !deviceId) return null;
  const snap = await db.collection('players').doc(String(deviceId)).get();
  return snap.exists ? (snap.data() || {}) : null;
}


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
    "Pastèque","Melon","Citron","Orange","Kiwi","Fraise","Noix de coco","Concombre",
    "Tomate","Poivron","Oignons","Hibiscus","Tipanier (frangipanier)","Rose","Corossol",
    "Laitue","Carotte","Aubergine","Courgette","Basilic"
  ],
  "Animaux": [
    "Chat","Chien","Tortue","Kangourou","Dauphin","Requin","Panda","Koala","Tigre",
    "Lion","Perroquet","Toucan","Cheval","Zèbre","Aigle","Faucon","Loutre","Castor",
    "Grenouille","Serpent","Souris"
  ],
  "Villes": [
    "Paris","Londres","Tokyo","Osaka","New York","Los Angeles","Rome","Athènes",
    "Madrid","Barcelone","Berlin","Munich","Rio","São Paulo","Sydney","Melbourne",
    "Montréal","Toronto","Le Caire","Alexandrie","Dubaï","Abu Dhabi","Manchester"
  ],
  "Pays": [
    "France","Japon","Brésil","Canada","Égypte","Italie","Espagne","Allemagne",
    "Australie","Maroc","Mexique","États-Unis","Chine","Inde","Royaume-Uni"
  ],
  "Sports": [
    "Football","Rugby","Tennis","Badminton","Basket","Handball","Boxe","Arts martiaux",
    "Formule 1","Rallye","Surf","Voile","Cyclisme","VTT (Vélo tout-terrain)","Ski","Snowboard","Golf",
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
    "Médecin","Infirmier","Professeur","Pompier","Policier","Cuisinier",
    "Serveur","Pilote","Hôtesse de l'Air","Architecte","Ingénieur",
    "Boulanger","Plombier","Électricien","Vétérinaire"
  ],
  "Transports": [
    "Voiture","Moto","Bus","Tram","Train","Métro","Avion","Hélicoptère","Bateau",
    "Ferry","Vélo","Trottinette"
  ],
  "Couleurs Formes": [
    "Rouge","Orange","Bleu","Cyan","Vert","Vert citron","Noir","Gris","Blanc","Ivoire",
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
    "Beyoncé","Rihanna","Cristiano Ronaldo","Lionel Messi","Taylor Swift","Ariana Grande",
    "Keanu Reeves","Tom Cruise","Elon Musk","Jeff Bezos","Drake","The Weeknd","Shakira",
    "Eminem","Adele","Lady Gaga","Robert Downey Jr.","Chris Hemsworth","Scarlett Johansson",
    "Zendaya","Dwayne Johnson","Jason Momoa","Serena Williams","Roger Federer","Michael Jordan",
    "Usain Bolt","Lewis Hamilton"
  ],
  "Marques": [
    "Apple","Samsung","Xiaomi","Sony","Dell","HP","JBL","Lenovo","BMW","Mercedes","Audi",
    "Tesla","Toyota","Honda","Peugeot","Renault","Ford","Ferrari","Lamborghini","Adidas",
    "Nike","Puma","Reebok","Lacoste","Coca-Cola","Pepsi","Nestlé","Red Bull","Starbucks",
    "Nutella","McDonald’s","Burger King","KFC"
  ]
};
// ——— Sous-familles par thème pour des paires "proches" ———
const CLUSTERS = {
  "Couleurs Formes": [
    ["Rouge","Orange","Bleu","Cyan","Vert","Vert citron","Noir","Gris","Blanc","Ivoire"], // Couleurs
    ["Cercle","Ellipse","Carré","Rectangle","Triangle","Pyramide"]                         // Formes
  ],
  "Fruits Fleurs Légumes": [
    ["Mangue","Papaye","Ananas","Banane","Pomme","Poire","Raisin","Myrtille","Pastèque","Melon","Citron","Orange","Kiwi","Fraise","Noix de coco","Corossol"], // Fruits
    ["Concombre","Tomate","Poivron","Oignons","Laitue","Carotte","Aubergine","Courgette","Basilic"],                                                          // Légumes/herbes
    ["Hibiscus","Tipanier (frangipanier)","Rose"]                                                                                                              // Fleurs
  ],
  "Animaux": [
    ["Chat","Chien","Kangourou","Panda","Koala","Tigre","Lion","Cheval","Zèbre","Loutre","Castor"], // Mammifères
    ["Perroquet","Toucan","Aigle","Faucon"],                                                        // Oiseaux
    ["Dauphin","Requin"],                                                                           // Mer
    ["Tortue","Grenouille","Serpent","Souris"]                                                      // Reptiles/Amphibiens & petits
  ],
  "Transports": [
    ["Voiture","Moto","Bus","Tram","Train","Métro","Trottinette","Vélo"],
    ["Avion","Hélicoptère"],
    ["Bateau","Ferry"]
  ],
  "Sports": [
    ["Football","Rugby","Basket","Handball"],
    ["Tennis","Badminton","Golf","Cricket"],
    ["Boxe","Arts martiaux","Danse"],
    ["Formule 1","Rallye","Surf","Voile","Cyclisme","VTT (Vélo tout-terrain)","Ski","Snowboard"]
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

// Tirage simple (ancien comportement) avec anti-répétition de domaines & mots
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

// Tirage "smart" : 2 mots du MÊME cluster (proches -> imposteur plus discret)
function pickPairSmart(room){
  room.used ||= {};
  room.lastDomains ||= [];
  const cooldown = room.domainCooldown ?? 1;

  const all = Object.keys(DOMAINS);
  const validDomains = all.filter(d => (DOMAINS[d]?.length || 0) >= 2);
  if (!validDomains.length) return { common:'Erreur', impostor:'Erreur', domain:'Aucun domaine' };

  const banned = new Set(room.lastDomains.slice(-cooldown));
  const candidates = validDomains.filter(d => !banned.has(d));
  const domain = (candidates.length ? pick(candidates) : pick(validDomains));

  room.used[domain] ||= new Set();
  const usedSet = room.used[domain];

  const clusters = CLUSTERS?.[domain];

  if (clusters && clusters.length){
    // Choisir un cluster avec au moins 2 mots (priorité aux non-utilisés)
    let cluster = pick(clusters), guard = 0;
    while (cluster.filter(w => !usedSet.has(w)).length < 2 && guard++ < 20){
      cluster = pick(clusters);
    }
    // pool prioritaire = non-utilisés
    let pool = cluster.filter(w => !usedSet.has(w));
    if (pool.length < 2) pool = cluster.slice();

    // mot commun (évite de répéter le dernier)
    let common = pick(pool);
    guard = 0;
    while (common === room.lastCommon && pool.length > 1 && guard++ < 10){
      common = pick(pool);
    }

    // imposteur ≠ commun
    let impostorChoices = pool.filter(w => w !== common);
    if (!impostorChoices.length) impostorChoices = cluster.filter(w => w !== common);
    const impostor = pick(impostorChoices);

    usedSet.add(common); usedSet.add(impostor);
    room.lastCommon = common;
    room.lastDomains.push(domain);
    if (room.lastDomains.length > 5) room.lastDomains.shift();

    // DEBUG (optionnel)
    // console.log('[pair]', domain, 'cluster=', cluster, '=>', common, impostor);

    return { common, impostor, domain };
  }

  // Fallback si aucun cluster défini pour ce domaine
  return pickPairFromDomainsUnique(room);
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
// ——— Libellés pour lever les ambiguïtés à l’écran ———
const CLUSTER_LABELS = {
  "Fruits Fleurs Légumes": ["(fruit)","(légume)","(fleur)"],
  "Couleurs Formes": ["(couleur)","(forme)"]
};

function labelWordByDomain(word, domain){
  const clusters = CLUSTERS?.[domain];
  const labels = CLUSTER_LABELS?.[domain];
  if (!clusters || !labels) return word;
  for (let i = 0; i < clusters.length && i < labels.length; i++){
    if (clusters[i].includes(word)) return `${word} ${labels[i]}`;
  }
  return word;
}


function startRound(code){
  const r = rooms.get(code); if(!r) return;
  clearRoomTimer(r);
  r.lobbyReady = new Set();
  r.readyNext  = new Set();

  const ids = Array.from(r.players.keys());
  if (ids.length < 3){
    io.to(code).emit('errorMsg','Minimum 3 joueurs');
    r.state = 'lobby'; broadcast(code); return;
  }

  // reset manche
  for (const p of r.players.values()){ p.hint=null; p.vote=null; p.isImpostor=false; }

  // Tirage 2 mots du MÊME cluster
  const pair = pickPairSmart(r);
  r.words = { common:pair.common, impostor:pair.impostor, domain:pair.domain };
  r.lastDomain = pair.domain; r.lastCommon = pair.common;

  // Choix de l'imposteur (fix: impId, pas "implId")
  const impId = pick(ids);
  r.impostor = impId;
  const imp = r.players.get(impId);
  if (imp) imp.isImpostor = true;

  r.round += 1;
  r.state = 'hints';

  // Envoi à chacun (fix: p/id n'existaient pas)
  for (const [id,p] of r.players.entries()){
    const myword = p.isImpostor ? r.words.impostor : r.words.common;
    io.to(id).emit('roundInfo', {
      word: myword, // brut
      wordDisplay: labelWordByDomain(myword, r.words.domain), // "Rose (fleur)"
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

  
// Persistance RP pour tout le monde (gagnants & perdants)
const winners = new Set();
if (caught) {
  for (const [id,p] of r.players.entries()) if (!p.isImpostor) winners.add(id);
} else if (impId) {
  winners.add(impId);
}
for (const [id,p] of r.players.entries()) {
  const didWin = winners.has(id);
  if (p?.deviceId) {
    upsertRoundResult({
      deviceId: p.deviceId,
      pseudo: p.name,
      didWin,
      isImpostor: !!p.isImpostor
    });
  }
}
r.state = 'reveal';
  io.to(code).emit('roundResult', {
  impostorId: impId,
  impostorName: r.players.get(impId)?.name,
  common: r.words.common,
  impostor: r.words.impostor,
  commonDisplay: labelWordByDomain(r.words.common, r.words.domain),
  impostorDisplay: labelWordByDomain(r.words.impostor, r.words.domain),
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
  let profile = { deviceId:null, lastPseudo:null };

  socket.on('hello', ({ deviceId, pseudo }={})=>{
    if (deviceId) profile.deviceId = String(deviceId).slice(0,64);
    if (pseudo) profile.lastPseudo = String(pseudo).slice(0,16);
  });
  socket.on('getLeaderboard', async ()=>{
  try{
    const top = await getTop50();
    socket.emit('leaderboardData', top);
  }catch(e){ socket.emit('errorMsg','Impossible de charger le Top 50'); }
});

socket.on('getMyStats', async ({ deviceId })=>{
  const doc = await getMyStats(String(deviceId||''));
  socket.emit('myStats', doc ? {
    rp: Number(doc.rp||0),
    rounds: Number(doc.rounds||0),
    wins: Number(doc.wins||0),
    winsCrew: Number(doc.winsCrew||0),
    winsImpostor: Number(doc.winsImpostor||0)
  } : { rp:0, rounds:0, wins:0, winsCrew:0, winsImpostor:0 });
});

  // ——— CRÉER ———
  socket.on('createRoom', ({name, deviceId})=>{
    const code = createRoom(socket.id, String(name||'Joueur').slice(0,16));
    socket.join(code); joined.code=code;
    profile.lastPseudo = String(name||'Joueur').slice(0,16);
    profile.deviceId = String(deviceId||profile.deviceId||'').slice(0,64) || null;
    // attach deviceId to host entry
    const r = rooms.get(code);
    if (r && r.players.has(socket.id)) {
      const p = r.players.get(socket.id);
      p.deviceId = profile.deviceId;
    }
    socket.emit('roomCreated',{code});
    broadcast(code);
  });

  // ——— REJOINDRE ———
  socket.on('joinRoom', ({ code, name, deviceId })=>{
    code = String(code||'').trim();
    if (!/^\d{4}$/.test(code)) return socket.emit('errorMsg','Code invalide (4 chiffres)');
    const r = rooms.get(code); if(!r) return socket.emit('errorMsg','Salle introuvable');

    socket.join(code); joined.code = code;
    profile.lastPseudo = String(name||'Joueur').slice(0,16);
    profile.deviceId = String(deviceId||profile.deviceId||'').slice(0,64) || null;
    r.players.set(socket.id, { name:profile.lastPseudo, hint:null, vote:null, isImpostor:false, score:0, deviceId: profile.deviceId });

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

  
  // ——— LEADERBOARD ———
  socket.on('getLeaderboard', async ()=>{
    try{
      const top = await getTop50();
      socket.emit('leaderboardData', top.map(x=>({ 
        deviceId: x.deviceId, 
        pseudo: x.lastPseudo || 'Joueur', 
        wins: Number(x.wins||0) 
      })));
    }catch(e){ socket.emit('errorMsg','Impossible de charger le Top 50'); }
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
