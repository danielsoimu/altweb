/**
 * ALTWEB Crypto Types
 */

export interface EncryptedPayload {
  iv: string;   // 12 bytes, base64url encoded
  salt: string; // 16 bytes, base64url encoded (for PBKDF2)
  ct: string;   // ciphertext, base64url encoded
  v: number;    // protocol version (1)
}

export interface PayloadEnvelope {
  v: 1;
  enc: boolean;         // true = encrypted content, false = public
  e?: EncryptedPayload; // encrypted payload (blocks or everything)
  d?: string;           // compressed data, base64url (public mode)
  m?: string;           // visible meta+style, compressed base64url (partial encryption)
  s?: string;           // signature (optional)
  pk?: string;          // public key (optional)
}

// Structure for visible meta in partial encryption
export interface VisibleMeta {
  meta: import('./content').PageMeta;
  style: import('./content').PageStyle;
}

export interface SignedContent {
  content: string;
  signature: string;
  publicKey: string;
  fingerprint: string;
}

export interface DecodeResult {
  page: import('./content').AltPage;
  verified: boolean;
  publicKeyFingerprint?: string;
}
