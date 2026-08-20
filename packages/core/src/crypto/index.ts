export { base64urlEncode, base64urlDecode } from './encoding';
export { deriveKey, generateSalt, generateIV } from './key-derivation';
export { encrypt, decrypt } from './aes-gcm';
export {
  generateSigningKeyPair,
  sign,
  verify,
  exportPublicKey,
  computeFingerprint,
} from './signing';
export {
  deriveIdentityFromPassphrase,
  deriveLegacyIdentityFromPassphrase,
  validateIdentityPassphrase,
  type DerivedIdentity,
  type PassphraseFeedbackKey,
} from './identity';
