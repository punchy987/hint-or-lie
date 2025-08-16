// Routes HTTP simples
const path = require('path');

module.exports = (app) => {
  // Santé
  app.get('/health', (_, res) => res.send('ok'));

  // Fallback vers l’index client
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });
};