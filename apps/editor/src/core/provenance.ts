/**
 * Provenance of a capsule loaded into the editor — what the badge shows.
 */

export interface Provenance {
  encrypted: boolean;
  signed: boolean;
  /** true/false = cryptographically verified; null = unsigned */
  verified: boolean | null;
  fingerprint?: string;
  title?: string;
}
