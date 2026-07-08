const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const salt = 'apexresolve_ai_salt';

const getCryptoKey = () => {
  const secret = process.env.JWT_SECRET || 'apexresolve_super_secret_jwt_key_123';
  return crypto.scryptSync(secret, salt, 32);
};

const encrypt = (text) => {
  if (!text) return '';
  try {
    const key = getCryptoKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('Encryption error:', err);
    return '';
  }
};

const decrypt = (text) => {
  if (!text || !text.includes(':')) return '';
  try {
    const key = getCryptoKey();
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err);
    return '';
  }
};

module.exports = {
  encrypt,
  decrypt
};
