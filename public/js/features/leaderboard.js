// public/js/features/leaderboard.js
// Gère l'affichage des scores en bas de l'écran avec AVATARS 🤖

(function () {
  const { $ } = window.HOL;

  function updateScoreboard(players) {
    const list = $('score-list');
    if (!list) return;

    // 1. On vide la liste actuelle
    list.innerHTML = '';

    // 2. On trie les joueurs (le premier est celui qui a le plus de points)
    // On fait une copie [...players] pour ne pas casser l'ordre ailleurs
    const sorted = [...(players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

    // 3. On crée les étiquettes
    sorted.forEach(p => {
      const li = document.createElement('li');
      
      // --- L'AVATAR ---
      const img = document.createElement('img');
      const seed = (p.name || '').trim() || 'default';
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.className = 'score-avatar'; // Le style qu'on a ajouté dans le CSS
      img.alt = '';
      
      // --- LE NOM ---
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      nameSpan.style.color = 'white'; // Nom en blanc
      nameSpan.style.fontWeight = 'normal';

      // --- LE SCORE ---
      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = p.score || 0;
      // On garde la couleur violette/primaire définie dans le CSS pour le chiffre
      
      // On assemble tout
      li.appendChild(img);
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);

      list.appendChild(li);
    });
  }

  function init() {
    // Rien de spécial à initier, c'est passif
  }

  // On expose la fonction pour qu'elle soit appelée par main.js ou home.js
  window.HOL = window.HOL || {};
  window.HOL.updateScoreboard = updateScoreboard;
  
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.leaderboard = { init };

})();