// routes/sockets/game/validate.js
const deburr = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const normalize = (s='') =>
  deburr(String(s).toLowerCase()).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();

function levenshtein(a,b){
  a = normalize(a); b = normalize(b);
  const m=a.length, n=b.length; if(!m) return n; if(!n) return m;
  const dp = Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[i-1]?0:1));
  return dp[m][n];
}

function isHintAllowed(secretWord, hint, domain){
  const h = normalize(hint);
  const w = normalize(secretWord);
  if (!h) return { ok:false, reason:"Indice vide." };
  const plurals = new Set([w, w+'s', w+'es']);
  if (plurals.has(h)) return { ok:false, reason:"Indice identique au mot." };
  const wordsInHint = new Set(h.split(' '));
  if (wordsInHint.has(w) || wordsInHint.has(w+'s') || wordsInHint.has(w+'es')) return { ok:false, reason:"Tu as utilisé le mot lui-même." };
  if (h.includes(w) && w.length>=4) return { ok:false, reason:"Indice trop proche du mot." };
  if (w.length>=5 && levenshtein(w,h) <= 2) return { ok:false, reason:"Indice presque identique." };
  const dom = normalize(domain||'');
  const domTokens = dom.split(' ').filter(Boolean);
  const banned = new Set();
  for (const t of domTokens){ banned.add(t); if (t.endsWith('es')) banned.add(t.slice(0,-2)); if (t.endsWith('s')) banned.add(t.slice(0,-1)); }
  if (banned.has(h)) return { ok:false, reason:"N’utilise pas le nom du thème." };
  for (const token of wordsInHint){ if (banned.has(token)) return { ok:false, reason:"Indice trop proche du thème." }; }
  return { ok:true };
}

module.exports = { deburr, normalize, levenshtein, isHintAllowed };
