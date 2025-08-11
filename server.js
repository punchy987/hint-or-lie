// server.js — domaines + anti-répétition + timers + ACK + progression + auto-vote + win@10pts
// +++ NOUVEAU : filtre anti-révélation du mot (indices trop proches/interdits) +++

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static('public'));

// Durées (secondes)
const HINT_SECONDS = 45;
const VOTE_SECONDS  = 40;
const REVEAL_SECONDS = 20; // écran résultat

// État en mémoire
// room: { hostId, state, round, players(Map), words, lastDomain, lastCommon, timer:{interval,deadline,phase} }
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const genCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// ----- Domaines -----
const DOMAINS = {
  "Fruits fleurs legumes": [
    'Mangue','Papaye','Ananas','Banane','Pomme','Poire','Raisin','Myrtille','Pasteque','Melon','Citron',
    'Orange','Kiwi','Fraise','Coco','Concombre','Tomate','Poivron','Oignons','Hibiscus','Tipanier','Rose',
    'Corossol','Laitue','Carotte','Aubergine','Courgette','Basilic'
  ],
  Animaux: [
    'Chat','Chien','Tortue','Kangourou','Dauphin','Requin','Panda','Koala','Tigre','Lion','Perroquet','Toucan',
    'Cheval','Zebre','Aigle','Faucon','Loutre','Castor','Grenouille','Serpent','Souris'
  ],
  Villes: [
    'Paris','Londres','Tokyo','Osaka','New York','Los Angeles','Rome','Athenes','Madrid','Barcelone','Berlin','Munich',
    'Rio','Sao Paulo','Sydney','Melbourne','Montreal','Toronto','Le Caire','Alexandrie','Dubai','Abu Dhabi','Manchester'
  ],
  Pays: [
    'France','Japon','Bresil','Canada','Egypte','Italie','Espagne','Allemagne','Australie','Maroc',
    'Mexique','USA','Chine','Inde','Royaume-Uni'
  ],
  Sports: [
    'Football','Rugby','Tennis','Badminton','Basket','Handball','Boxe','MMA','Formule 1','Rallye','Surf','Voile',
    'Cyclisme','VTT','Ski','Snowboard','Golf','Cricket','Danse'
  ],
  Objets: [
    'Chaise','Tabouret','Table','Bureau','Telephone','Tablette','Ordinateur','Console','Cle','Serrure','Lampe','Bougie',
    'Valise','Sac a dos','Montre','Bracelet','Lunettes','Casque','Stylo','Crayon','Tasse','Verre','Ciseaux','Cutter'
  ],
  Nature: [
    'Plage','Montagne','Foret','Desert','Lac','Riviere','Ile','Continent','Volcan','Glacier','Cascade','Geyser','Ciel','Ocean','Soleil','Lune'
  ],
  Metiers: [
    'Medecin','Infirmier','Professeur','Etudiant','Pompier','Policier','Cuisinier','Serveur','Pilote','Steward','Architecte','Ingenieur'
  ],
  Transports: [
    'Voiture','Moto','Bus','Tram','Train','Metro','Avion','Helicoptere','Bateau','Ferry','Velo','Trottinette'
  ],
  CouleursFormes: [
    'Rouge','Orange','Bleu','Cyan','Vert','Lime','Noir','Gris','Blanc','Ivoire','Cercle','Ellipse','Carre','Rectangle','Triangle','Pyramide'
  ],
  Cinema: [
    'Star Wars','Harry Potter','Le Seigneur des Anneaux','Marvel','DC Comics','Batman','Superman',
    'Iron Man','Captain America','Avengers','Black Panther','Doctor Strange','Spider-Man','Hulk',
    'Joker','Wonder Woman','Aquaman','The Flash',
    'Avatar','Titanic','Jurassic Park','Jurassic World','Indiana Jones','Matrix','Inception','Interstellar',
    'Le Roi Lion','La Reine des Neiges','Toy Story','Cars','Coco','Vice-Versa','Les Indestructibles'
  ],
  Manga: [
    'Naruto','One Piece','Dragon Ball','Bleach','Pokemon','My Hero Academia','Attack on Titan','Death Note',
    'Fullmetal Alchemist','One Punch Man','Demon Slayer','Jujutsu Kaisen','Hunter x Hunter',
    'Fairy Tail','Black Clover','Chainsaw Man',
  ],
  Personnalites: [
    'Beyonce','Rihanna','Cristiano Ronaldo','Lionel Messi','Taylor Swift','Ariana Grande','Keanu Reeves','Tom Cruise',
    'Elon Musk','Jeff Bezos','Drake','The Weeknd','Shakira','Eminem','Adele','Lady Gaga',
    'Robert Downey Jr.','Chris Hemsworth','Scarlett Johansson','Zendaya','Dwayne Johnson','Jason Momoa',
    'Serena Williams','Roger Federer','Michael Jordan','Usain Bolt','Lewis Hamilton'
  ],
  Marques: [
    'Apple','Samsung','Xiaomi','Sony','Dell','HP','JBL','Lenovo',
    'BMW','Mercedes','Audi','Tesla','Toyota','Honda','Peugeot','Renault','Ford','Ferrari','Lamborghini',
    'Adidas','Nike','Puma','Reebok','Lacoste',
    'Coca-Cola','Pepsi','Nestle','Red Bull','Starbucks','Nutella','McDonalds','Burger King','KFC'
  ],
};

// ---------- Utilitaires anti-révélation du mot ----------
const deburr = (s='') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); // enlève accents

const normalize = (s='') =>
  deburr(String(s).toLowerCase())
    .replace(/[^a-z0-9 ]+/g,' ')   // enlève ponctuation
    .replace(/\s+/g,' ')           // espaces uniques
    .trim();

function levenshtein(a,b){
  a = normalize(a); b = normalize(b);
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      dp[i][j] = Math.min(
        dp[i-1][j]+1,
        dp[i][j-1]+1,
        dp[i-1][j-1] + (a[i-1]===b[j-1]?0:1)
      );
    }
  }
  return dp[m][n];
}

// Règles :
// - indice non vide
// - interdit si contient mot exact (avec ou sans accents/pluriels simples)
// - interdit si distance de Levenshtein <=2 pour mots > 4 lettres
// - interdit si mot est contenu dans l’indice sous forme de mot isolé
function isHintAllowed(secretWord, hint, domain){
  const h = normalize(hint);
  const w = normalize(secretWord);
  if (!h) return { ok:false, reason:"Indice vide." };

  // exact / pluriels simples
  const candidates = new Set([w, w+'s', w+'es']);
  if (candidates.has(h)) return { ok:false, reason:"Indice trop évident (identique au mot)." };

  // mot isolé dans la phrase (ex: 'petite pomme verte')
  const words = new Set(h.split(' '));
  if (words.has(w) || words.has(w+'s') || words.has(w+'es')){
    return { ok:false, reason:"Tu as utilisé le mot lui-même." };
  }

  // sous-chaîne claire
  if (h.includes(w) && w.length >= 4){
    return { ok:false, reason:"Indice trop proche du mot." };
  }

  // distance d’édition
  if (w.length >= 5 && levenshtein(w, h) <= 2){
    return { ok:false, reason:"Indice presque identique au mot." };
  }

  // Interdire donner exactement le domaine
  if (normalize(domain) === h){
    return { ok:false, reason:"Ne mets pas le nom du domaine." };
  }

  return { ok:true };
}

// Tirer 2 mots du même domaine (+ éviter répétitions)
function pickPairFromDomains(prevDomain = null, prevCommon = null) {
  const names = Object.keys(DOMAINS);
  const candidates = names.filter(n => n !== prevDomain);
  const domain = (candidates.length ? pick(candidates) : pick(names));
  const pool = DOMAINS[domain] || [];
  if (pool.length < 2) return { common: 'Erreur', impostor: 'Erreur', domain };

  let common = pick(pool);
  let guard = 0;
  while (common === prevCommon && guard++ < 10) common = pick(pool);

  let impostor = pick(pool);
  guard = 0;
  while (impostor === common && guard++ < 10) impostor = pick(pool);

  return { common, impostor, domain };
}

// Timers
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
    if (leftMs <= 0){
      clearRoomTimer(room);
      onExpire?.();
    }
  }, 500);
}

// Helpers
function createRoom(hostId, hostName) {
  let code; do { code = genCode(); } while (rooms.has(code));
  const r = {
    hostId, state:'lobby', round:0, words:null,
    players:new Map(), lastDomain:null, lastCommon:null,
    timer:{ interval:null, deadline:0, phase:null }
  };
  r.players.set(hostId, { name: hostName, hint:null, vote:null, isImpostor:false, score:0 });
  rooms.set(code, r);
  return code;
}
function snapshot(code){
  const r = rooms.get(code); if(!r) return null;
  const players = Array.from(r.players.entries()).map(([id,p])=>({id,name:p.name,score:p.score}));
  return { code, state:r.state, round:r.round, players };
}
function broadcast(code){ const s=snapshot(code); if(s) io.to(code).emit('roomUpdate', s); }

// Flow
function startRound(code){
  const r = rooms.get(code); if(!r) return;
  clearRoomTimer(r);

  const ids = Array.from(r.players.keys());
  if(ids.length < 3){ io.to(code).emit('errorMsg','Minimum 3 joueurs'); return; }

  for(const p of r.players.values()){ p.hint=null; p.vote=null; p.isImpostor=false; }

  const pair = pickPairFromDomains(r.lastDomain, r.lastCommon);
  r.lastDomain = pair.domain;
  r.lastCommon = pair.common;

  const impId = pick(ids);
  r.words = { common: pair.common, impostor: pair.impostor, domain: pair.domain };
  r.round += 1; r.state='hints';

  for(const [id,p] of r.players.entries()){
    p.isImpostor = (id===impId);
    io.to(id).emit('roundInfo', {
      word: p.isImpostor ? r.words.impostor : r.words.common,
      isImpostor: p.isImpostor,
      domain: r.words.domain
    });
  }

  io.to(code).emit('phaseProgress', { phase:'hints', submitted:0, total: ids.length });

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
  if(!ok) return;
  r.state='voting';
  const hints = Array.from(r.players.entries()).map(([id,p])=>({id,name:p.name,hint:p.hint||''}));
  io.to(code).emit('allHints', { hints, domain: r.words?.domain || null });

  io.to(code).emit('phaseProgress', { phase:'voting', submitted:0, total: r.players.size });

  startPhaseTimer(code, VOTE_SECONDS, 'voting', ()=>{
    const room = rooms.get(code); if (!room) return;
    for (const [id,p] of room.players.entries()) if (!p.vote) p.vote = id;
    finishVoting(code);
  });

  broadcast(code);
}

function finishVoting(code){
  const r = rooms.get(code); if(!r || r.state!=='voting') return;
  const allVoted = Array.from(r.players.values()).every(p => p.vote);
  if(!allVoted) return;

  clearRoomTimer(r);

  let impId = null; for(const [id,p] of r.players.entries()) if(p.isImpostor) impId=id;
  const tally = {};
  for(const p of r.players.values()) tally[p.vote] = (tally[p.vote]||0)+1;

  let top=null, max=-1; for(const [t,c] of Object.entries(tally)){ if(c>max){max=c; top=t;} }
  const caught = (top===impId);

  if(caught){ for(const p of r.players.values()) if(!p.isImpostor) p.score += 1; }
  else { const imp = r.players.get(impId); if(imp) imp.score += 2; }

  r.state='reveal';
  io.to(code).emit('roundResult', {
    impostorId: impId,
    impostorName: r.players.get(impId)?.name,
    common: r.words.common, impostor: r.words.impostor,
    votes: tally, impostorCaught: caught,
    domain: r.words.domain
  });
  broadcast(code);

  const playersArr = Array.from(r.players.values());
  const maxScore = Math.max(...playersArr.map(p => p.score));

  if (maxScore >= 10){
    const winners = Array.from(r.players.entries())
      .filter(([_,p]) => p.score === maxScore)
      .map(([id,p]) => ({ id, name:p.name, score:p.score }));
    r.state = 'lobby';
    io.to(code).emit('gameOver', { winners });
    broadcast(code);
    return;
  }

  startPhaseTimer(code, REVEAL_SECONDS, 'reveal', ()=>{
    startRound(code);
  });
}

// Sockets
io.on('connection',(socket)=>{
  let joined = { code:null };

  socket.on('createRoom', ({name})=>{
    const code = createRoom(socket.id, String(name||'Joueur').slice(0,16));
    socket.join(code); joined.code=code;
    socket.emit('roomCreated',{code}); broadcast(code);
  });

  socket.on('joinRoom', ({code,name})=>{
    code = String(code||'').trim().toUpperCase();
    const r = rooms.get(code); if(!r) return socket.emit('errorMsg','Salle introuvable');
    socket.join(code); joined.code=code;
    r.players.set(socket.id, { name:String(name||'Joueur').slice(0,16), hint:null, vote:null, isImpostor:false, score:0 });
    socket.emit('roomJoined',{code}); broadcast(code);
  });

  socket.on('startRound', ()=>{
    const r = rooms.get(joined.code); if(!r) return;
    if(r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut démarrer");
    startRound(joined.code);
    socket.emit('actionAck', { action:'startRound', status:'ok' });
  });

  // --------- NOUVEAU : validation serveur des indices ----------
  socket.on('submitHint', ({hint})=>{
    const r = rooms.get(joined.code); if(!r || r.state!=='hints') return;
    const p = r.players.get(socket.id); if(!p) return;
    if (typeof p.hint === 'string') return; // anti double envoi

    const raw = String(hint||'').trim().slice(0,40);

    // déterminer le mot du joueur (commun ou imposteur) + domaine
    const mySecret = p.isImpostor ? r.words.impostor : r.words.common;
    const check = isHintAllowed(mySecret, raw, r.words.domain);

    if (!check.ok){
      // on refuse : on informe seulement le joueur
      socket.emit('hintRejected', { reason: check.reason });
      return;
    }

    // OK
    p.hint = raw;
    socket.emit('hintAck');
    const submitted = Array.from(r.players.values()).filter(x => typeof x.hint === 'string').length;
    io.to(joined.code).emit('phaseProgress', { phase:'hints', submitted, total: r.players.size });

    maybeStartVoting(joined.code);
    broadcast(joined.code);
  });

  socket.on('submitVote', ({targetId})=>{
    const r = rooms.get(joined.code); if(!r || r.state!=='voting') return;
    if(!r.players.has(targetId)) return;
    const p = r.players.get(socket.id); if(!p) return;
    if (p.vote) return;
    p.vote = targetId;

    socket.emit('voteAck');
    const submitted = Array.from(r.players.values()).filter(x => !!x.vote).length;
    io.to(joined.code).emit('phaseProgress', { phase:'voting', submitted, total: r.players.size });

    finishVoting(joined.code);
    broadcast(joined.code);
  });

  socket.on('resetScores', ()=>{
    const r = rooms.get(joined.code); if(!r) return;
    if(r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut réinitialiser");
    for (const p of r.players.values()) p.score = 0;
    r.round = 0; r.state = 'lobby';
    io.to(joined.code).emit('scoresReset');
    broadcast(joined.code);
  });

  socket.on('nextRound', ()=>{
    const r = rooms.get(joined.code); if(!r) return;
    if(r.hostId !== socket.id) return;
    startRound(joined.code);
    socket.emit('actionAck', { action:'nextRound', status:'ok' });
  });

  socket.on('disconnect',()=>{
    const code = joined.code; if(!code) return;
    const r = rooms.get(code); if(!r) return;
    r.players.delete(socket.id);
    if(r.hostId===socket.id){
      const first = r.players.keys().next().value;
      if(first) r.hostId = first; else rooms.delete(code);
    }
    broadcast(code);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log('🚀 Hint or Lie (by Mits) est en ligne !'));
