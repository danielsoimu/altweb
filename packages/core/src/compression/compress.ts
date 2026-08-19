/**
 * Compression using pako (deflate).
 *
 * decompress() enforces a hard output cap: the input is attacker-controlled
 * on every decode path (URL hash, files handed to the CLI/MCP server), and
 * a few KB of crafted deflate can otherwise expand to GB (decompression
 * bomb → OOM/DoS). Streaming inflate lets us abort as soon as the cap is
 * crossed instead of materializing the whole output first.
 */

import pako from 'pako';

/** Hard cap on decompressed payload size (bytes). */
export const MAX_DECOMPRESSED_BYTES = 16 * 1024 * 1024;

export function compress(data: Uint8Array): Uint8Array {
  return pako.deflate(data, { level: 9 }); // maximum compression
}

export function decompress(data: Uint8Array): Uint8Array {
  const inflator = new pako.Inflate();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let bombed = false;

  inflator.onData = (chunk: pako.Data) => {
    const bytes =
      typeof chunk === 'string'
        ? new TextEncoder().encode(chunk)
        : chunk instanceof Uint8Array
          ? chunk
          : new Uint8Array(chunk);
    total += bytes.length;
    if (total > MAX_DECOMPRESSED_BYTES) {
      bombed = true;
      // Signal pako to stop producing output for this stream.
      inflator.err = -2;
      return;
    }
    chunks.push(bytes);
  };
  inflator.onEnd = () => {};

  inflator.push(data, true);

  if (bombed) {
    throw new Error(
      `Decompressed payload exceeds the ${MAX_DECOMPRESSED_BYTES} byte limit`
    );
  }
  if (inflator.err) {
    throw new Error(inflator.msg || 'invalid deflate stream');
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
