# Hint or Lie - Règles et fonctionnement

## Présentation
Hint or Lie est un jeu multijoueur en ligne de déduction et de bluff.
Chaque partie oppose des équipiers à un imposteur caché.  
Les joueurs doivent donner des indices en fonction d’un mot secret,  
mais l’imposteur a un mot différent et doit essayer de se fondre dans la masse.

## Phases du jeu

1. **Accueil**
   - Les joueurs choisissent un pseudo.
   - Ils peuvent consulter les règles depuis cette page.

2. **Salon d’attente**
   - Les joueurs se rejoignent dans le lobby.
   - Chacun doit cliquer sur **"Prêt"**.
   - Quand tous sont prêts, un compte à rebours de 10 secondes démarre.
   - Si un joueur rejoint pendant le compte à rebours, celui-ci est annulé et tous doivent se remettre prêts.

3. **Début de manche**
   - Un **thème** est annoncé (ex : formes, couleurs…).
   - Les équipiers reçoivent tous **le même mot** lié au thème.
   - L’imposteur reçoit **un mot différent** du même thème.
   - Les mots sont choisis de façon à être proches pour rendre la déduction plus difficile (système de "clusters").

4. **Phase d’indices**
   - Dans l’ordre, chaque joueur donne un **indice** (un seul mot) pour décrire son mot secret.
   - Les équipiers tentent d’être clairs sans trop aider l’imposteur.
   - L’imposteur doit donner un indice qui ne trahit pas son mot.

5. **Vote**
   - Après avoir vu tous les indices, les joueurs votent pour celui qu’ils pensent être l’imposteur.
   - L’imposteur peut voter aussi.

6. **Résultat**
   - Le joueur avec le plus de votes est révélé.
   - S’il s’agit de l’imposteur, les équipiers marquent des points.
   - Sinon, l’imposteur marque des points.
   - Un nouveau tour commence jusqu’à la fin de la partie.

## Système de points
- **Imposteur découvert** : +3 RP pour les équipiers.
- **Imposteur non découvert** : +3 RP pour l’imposteur.
- Les RP servent à suivre le classement des joueurs.

## Commandes importantes pour développement local
- Lancer le serveur :  
  `node server.js`
- Envoyer les modifications en ligne :