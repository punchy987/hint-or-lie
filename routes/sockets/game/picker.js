// routes/sockets/game/picker.js
const path = require('path');

const { DOMAINS } =
  require(path.join(__dirname, 'words.js'));
const { pick } =
  require(path.join(__dirname, '..', 'utils', 'random.js'));

// Tirage "unique" sans clusters, avec anti-doublons + anti répétition immédiate
function pickPair(room) {
  room.used ||= {};
  room.lastDomains ||= [];
  const cooldown = room.domainCooldown ?? 1;

  const all = Object.keys(DOMAINS);
  const validDomains = all.filter(d => (DOMAINS[d]?.length || 0) >= 2);
  if (!validDomains.length) return { common: 'Erreur', impostor: 'Erreur', domain: 'Aucun domaine' };

  // évite de reprendre le même domaine trop souvent (cooldown)
  const banned = new Set(room.lastDomains.slice(-cooldown));
  const candidates = validDomains.filter(d => !banned.has(d));
  const domain = (candidates.length ? pick(candidates) : pick(validDomains));

  room.used[domain] ||= new Set();
  const usedSet = room.used[domain];

  // anti-doublons: on privilégie les mots jamais sortis; sinon on rouvre le pool
  const pool0 = DOMAINS[domain].slice();
  let pool = pool0.filter(w => !usedSet.has(w));
  if (pool.length < 2) pool = pool0.slice();

  // mot commun: éviter de retomber deux fois de suite sur le même
  let common = pick(pool);
  let guard = 0;
  while (common === room.lastCommon && pool.length > 1 && guard++ < 10) {
    common = pick(pool);
  }

  // imposteur ≠ commun; fallback si nécessaire
  let impostorChoices = pool.filter(w => w !== common);
  if (!impostorChoices.length) impostorChoices = pool0.filter(w => w !== common);
  const impostor = pick(impostorChoices);

  // marquer comme utilisés
  usedSet.add(common);
  usedSet.add(impostor);

  room.lastCommon = common;
  room.lastDomains.push(domain);
  if (room.lastDomains.length > 5) room.lastDomains.shift();

  return { common, impostor, domain };
}

module.exports = { pickPair };
