const path = require('path');

const { DOMAINS, CLUSTERS } =
  require(path.join(__dirname, 'words.js'));
const { pick } =
  require(path.join(__dirname, '..', 'utils', 'random.js'));
function pickPairFromDomainsUnique(room) {
  room.used ||= {}; room.lastDomains ||= []; const cooldown = room.domainCooldown ?? 1;
  const all = Object.keys(DOMAINS); const validDomains = all.filter(d => (DOMAINS[d]?.length || 0) >= 2);
  if (!validDomains.length) return { common:'Erreur', impostor:'Erreur', domain:'Aucun domaine' };
  const banned = new Set(room.lastDomains.slice(-cooldown)); const candidates = validDomains.filter(d => !banned.has(d));
  const domain = (candidates.length ? pick(candidates) : pick(validDomains));
  room.used[domain] ||= new Set(); const usedSet = room.used[domain];
  const pool0 = DOMAINS[domain].slice(); let pool = pool0.filter(w => !usedSet.has(w)); if (pool.length < 2) pool = pool0.slice();
  let common = pick(pool); let guard = 0; while (common === room.lastCommon && pool.length > 1 && guard++ < 10) common = pick(pool);
  const impostor = pick(pool.filter(w => w !== common)); usedSet.add(common); usedSet.add(impostor);
  room.lastCommon = common; room.lastDomains.push(domain); if (room.lastDomains.length > 5) room.lastDomains.shift();
  return { common, impostor, domain };
}
function pickPairSmart(room){
  room.used ||= {}; room.lastDomains ||= []; const cooldown = room.domainCooldown ?? 1;
  const all = Object.keys(DOMAINS); const validDomains = all.filter(d => (DOMAINS[d]?.length || 0) >= 2);
  if (!validDomains.length) return { common:'Erreur', impostor:'Erreur', domain:'Aucun domaine' };
  const banned = new Set(room.lastDomains.slice(-cooldown)); const candidates = validDomains.filter(d => !banned.has(d));
  const domain = (candidates.length ? pick(candidates) : pick(validDomains));
  room.used[domain] ||= new Set(); const usedSet = room.used[domain];
  const clusters = CLUSTERS?.[domain];
  if (clusters && clusters.length){
    let cluster = pick(clusters), guard = 0;
    while (cluster.filter(w => !usedSet.has(w)).length < 2 && guard++ < 20) cluster = pick(clusters);
    let pool = cluster.filter(w => !usedSet.has(w)); if (pool.length < 2) pool = cluster.slice();
    let common = pick(pool); guard = 0; while (common === room.lastCommon && pool.length > 1 && guard++ < 10) common = pick(pool);
    let impostorChoices = pool.filter(w => w !== common); if (!impostorChoices.length) impostorChoices = cluster.filter(w => w !== common);
    const impostor = pick(impostorChoices);
    usedSet.add(common); usedSet.add(impostor);
    room.lastCommon = common; room.lastDomains.push(domain); if (room.lastDomains.length > 5) room.lastDomains.shift();
    return { common, impostor, domain };
  }
  return pickPairFromDomainsUnique(room);
}
module.exports = { pickPairFromDomainsUnique, pickPairSmart };