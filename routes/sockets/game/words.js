// --- sockets/game/words.js ---
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
    "Grenouille","Serpent","Souris","Poisson","Hérisson"
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
    "Football","Rugby","Tennis","Badminton","Basket","Handball","Boxe","Kung-fu",
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
    "Voilier","Vélo","Trottinette","Jet-sky","Sous-marin","Mongolfière","Deltaplane"
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
const CLUSTERS = {
  "Couleurs Formes": [
    ["Rouge","Orange","Bleu","Cyan","Vert","Vert citron","Noir","Gris","Blanc","Ivoire"],
    ["Cercle","Ellipse","Carré","Rectangle","Triangle","Pyramide"]
  ],
  "Fruits Fleurs Légumes": [
    ["Mangue","Papaye","Ananas","Banane","Pomme","Poire","Raisin","Myrtille","Pastèque","Melon","Citron","Orange","Kiwi","Fraise","Noix de coco","Corossol"],
    ["Concombre","Tomate","Poivron","Oignons","Laitue","Carotte","Aubergine","Courgette","Basilic"],
    ["Hibiscus","Tipanier (frangipanier)","Rose"]
  ],
  "Animaux": [
    ["Chat","Chien","Kangourou","Panda","Koala","Tigre","Lion","Cheval","Zèbre","Loutre","Castor","Ours"],
    ["Perroquet","Toucan","Aigle","Faucon"],
    ["Dauphin","Requin","Poisson","Tortue"],
    ["Hérisson","Grenouille","Serpent","Souris"]
  ],
  "Transports": [
    ["Voiture","Moto","Bus","Tram","Train","Métro","Trottinette","Vélo"],
    ["Avion","Hélicoptère","Mongolfière","Deltaplane"],
    ["Voilier","Jet-sky","Sous-marin","Ferry"]
  ],
  "Sports": [
    ["Football","Rugby","Basket","Handball"],
    ["Tennis","Badminton","Golf","Cricket"],
    ["Boxe","Kung-fu","Danse","Karaté"],
    ["Formule 1","Rallye","Surf","Voile","Cyclisme","VTT (Vélo tout-terrain)","Ski","Snowboard"]
  ]
};
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
module.exports = { DOMAINS, CLUSTERS, CLUSTER_LABELS, labelWordByDomain };