const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// routes & sockets
const setupRoutes = require('./routes');
const setupSockets = require('./routes/sockets');

// config générale (tes HINT_SECONDS etc. si besoin)
const config = require('./config');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
setupRoutes(app);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Firebase (optionnel)
let db = null;
try { ({ db } = require('./config/firebase.js')); }
catch { console.log('⚠️ Firebase non configuré — tests sans persistence.'); }

// branchement sockets
setupSockets(io, db);

// listen
const PORT = process.env.PORT || 5500;
server.listen(PORT, () => console.log('Hint or Lie — port', PORT));
