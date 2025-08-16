// Constantes configurables (via variables d’env.)
module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  HINT_SECONDS: Number(process.env.HINT_SECONDS) || 45,
  VOTE_SECONDS: Number(process.env.VOTE_SECONDS) || 40,
  LOBBY_READY_SECONDS: Number(process.env.LOBBY_READY_SECONDS) || 10,
};