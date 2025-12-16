const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    modulusLength: 4096,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

fs.writeFileSync(path.join(__dirname, 'public.pem'), publicKey);
fs.writeFileSync(path.join(__dirname, 'private.pem'), privateKey);

console.log('✅ Keys generated: public.pem and private.pem');
console.log('⚠️  KEEP private.pem SECRET! Do not commit it to git.');
