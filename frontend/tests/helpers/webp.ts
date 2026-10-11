/** Reads the pixel size of a WebP file from its header, so a test can check that the width and height written in the code
 * are the real ones, without an image library. The format (RIFF, then one of three chunks) is described in Google's WebP
 * container specification: "VP8 " (lossy), "VP8L" (lossless) and "VP8X" (extended).
 */
import { readFileSync } from "node:fs";

export type PixelSize = { width: number; height: number };

export function readWebpSize(path: string): PixelSize {
  const bytes = readFileSync(path);
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`${path} is not a WebP file`);
  }
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Lossy: 14 bits for each size, after the 3-byte frame tag and the 3-byte start code.
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    // Lossless: 14 bits each, minus one, packed after a 1-byte signature.
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    // Extended: 24 bits each, minus one.
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`${path}: unknown WebP chunk "${chunk}"`);
}
