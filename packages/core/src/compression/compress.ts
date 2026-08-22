/**
 * Compression using pako (deflate).
 *
 * decompress() bounds BOTH memory and CPU against decompression bombs: the
 * input is attacker-controlled on every decode path (URL hash, files handed
 * to the CLI/MCP server), and a few KB of crafted deflate can otherwise
 * expand to GB. The input is rejected above MAX_COMPRESSED_BYTES before any
 * inflate work, then fed to the inflator in slices so the loop can actually
 * stop once the output cap is crossed — a single push() inflates its whole
 * input regardless of any flag set from onData, so the abort must happen
 * BETWEEN pushes, not inside the callback.
 */

import pako from 'pako';

/** Hard cap on decompressed payload size (bytes). */
export const MAX_DECOMPRESSED_BYTES = 16 * 1024 * 1024;

/**
 * Hard cap on compressed input size (bytes). A legitimate payload never
 * exceeds the decompressed cap by more than deflate's framing overhead
 * (~0.03%), so anything larger is rejected before a single byte is inflated.
 */
export const MAX_COMPRESSED_BYTES = 17 * 1024 * 1024;

/**
 * Slice size for the streaming inflate loop. Bounds the overshoot past
 * MAX_DECOMPRESSED_BYTES: deflate expands at most ~1032x, so one slice can
 * add ~66 MB of work before the between-slices check fires — instead of a
 * 2 MB bomb inflating its full ~2 GB on one push.
 */
const INFLATE_SLICE_BYTES = 64 * 1024;

export function compress(data: Uint8Array): Uint8Array {
  return pako.deflate(data, { level: 9 }); // maximum compression
}

export function decompress(data: Uint8Array): Uint8Array {
  if (data.length > MAX_COMPRESSED_BYTES) {
    throw new Error(
      `Compressed payload exceeds the ${MAX_COMPRESSED_BYTES} byte limit`
    );
  }

  // `ended` is a real runtime property of pako's Inflate (set when the
  // stream finishes); @types/pako just does not declare it.
  const inflator = new pako.Inflate() as pako.Inflate & { ended: boolean };
  const chunks: Uint8Array[] = [];
  let total = 0;

  inflator.onData = (chunk: pako.Data) => {
    const bytes =
      typeof chunk === 'string'
        ? new TextEncoder().encode(chunk)
        : chunk instanceof Uint8Array
          ? chunk
          : new Uint8Array(chunk);
    total += bytes.length;
    chunks.push(bytes);
  };
  // NOTE: pako's default onEnd is what records err/msg on a broken stream —
  // do not override it, or invalid input degrades to a silent empty result.

  if (data.length === 0) {
    inflator.push(data, true);
  }
  for (let offset = 0; offset < data.length; offset += INFLATE_SLICE_BYTES) {
    const last = offset + INFLATE_SLICE_BYTES >= data.length;
    inflator.push(data.subarray(offset, offset + INFLATE_SLICE_BYTES), last);
    if (total > MAX_DECOMPRESSED_BYTES) {
      throw new Error(
        `Decompressed payload exceeds the ${MAX_DECOMPRESSED_BYTES} byte limit`
      );
    }
    if (inflator.err) {
      throw new Error(inflator.msg || 'invalid deflate stream');
    }
    if (inflator.ended) break;
  }

  if (inflator.err || !inflator.ended) {
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
