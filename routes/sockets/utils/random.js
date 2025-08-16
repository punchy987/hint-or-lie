// --- sockets/utils/random.js ---
const CODE_CHARS = '0123456789';
const CODE_LENGTH = 4;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const genCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
module.exports = { pick, genCode };
