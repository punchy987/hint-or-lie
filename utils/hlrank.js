// utils/hlrank.js
// routes/utils/hlrank.js
// Paliers HL Rank + pénalités

function getHlRank(rp) {
  if (rp >= 200) return 'Maître';
  if (rp >= 150) return 'Diamant';
  if (rp >= 120) return 'Or';
  if (rp >= 80)  return 'Argent';
  if (rp >= 40)  return 'Bronze';
  return 'Novice';
}

function getPenaltyByRank(rank) {
  switch(rank) {
    case 'Maître':   return 5;
    case 'Diamant':  return 4;
    case 'Or':       return 3;
    case 'Argent':   return 2;
    case 'Bronze':   return 1;
    case 'Novice':   return 0;
    default: return 0;
  }
}

module.exports = { getHlRank, getPenaltyByRank };

/**
 * Calcule les updates de fin de partie pour TOUS les joueurs.
 * - On applique la pénalité à tous sauf au vainqueur.
 * - La pénalité est basée sur le RANG AVANT mise à jour.
 *
 * @param {Array} players - Liste des joueurs de la partie, format:
 *   {
 *     id: string,          // identifiant stable (deviceId, userId…)
 *     pseudo: string,
 *     rp_total: number,    // total AVANT cette partie (HL Points cumulés)
 *     earned: number       // points gagnés pendant la partie (ton système actuel)
 *   }
 * @param {string} winnerId - id du vainqueur (celui qui atteint 10 en premier)
 * @param {Object} [opts]
 *   @param {boolean} [opts.clampMinZero=true] - empêche de passer sous 0
 *
 * @returns {Array} updates - une ligne par joueur :
 *   {
 *     id, pseudo,
 *     rp_before, rp_gain, penalty, rp_after,
 *     rank_before, rank_after,
 *     victoires_inc, parties_inc
 *   }
 */
function computeEndgameUpdates(players, winnerId, opts = {}) {
  const { clampMinZero = true } = opts;

  return players.map(p => {
    const rp_before = Number(p.rp_total) || 0;
    const rank_before = getHlRank(rp_before);
    const isWinner = p.id === winnerId;

    const rp_gain = Number(p.earned) || 0;            // points gagnés pendant la partie (déjà selon tes règles actuelles)
    const penalty  = isWinner ? 0 : getPenaltyByRank(rank_before);

    let rp_after = rp_before + rp_gain - penalty;
    if (clampMinZero && rp_after < 0) rp_after = 0;

    const rank_after = getHlRank(rp_after);

    return {
      id: p.id,
      pseudo: p.pseudo || '',
      rp_before,
      rp_gain,
      penalty,
      rp_after,
      rank_before,
      rank_after,
      victoires_inc: isWinner ? 1 : 0,
      parties_inc: 1,
      isWinner
    };
  });
}

module.exports = {
  getHlRank,
  getPenaltyByRank,
  computeEndgameUpdates,
};
