import crypto from "node:crypto";
import { huffmanEncode, huffmanDecode } from "./huffman.js";
import { rleEncode, rleDecode } from "./rle.js";
export { CorruptDataError } from "./errors.js";

export function computeMetrics(originalSize, compressedSize) {
  return {
    ratio: originalSize === 0 ? null : originalSize / compressedSize,
    spaceSavedPercent:
      originalSize === 0
        ? 0
        : ((originalSize - compressedSize) / originalSize) * 100,
  };
}

export function compressWithVerification(buffer, algorithm) {
  const original = Buffer.from(buffer);
  const encodeStart = process.hrtime.bigint();
  let encoded;
  let huffman;
  if (algorithm === "huffman") {
    ({ output: encoded, details: huffman } = huffmanEncode(original));
  } else if (algorithm === "rle") encoded = rleEncode(original);
  else throw new Error("Unsupported algorithm");
  const encodeTimeMs = Number(process.hrtime.bigint() - encodeStart) / 1e6;
  const decodeStart = process.hrtime.bigint();
  const restored =
    algorithm === "huffman" ? huffmanDecode(encoded) : rleDecode(encoded);
  const decodeTimeMs = Number(process.hrtime.bigint() - decodeStart) / 1e6;
  const originalSha256 = crypto
    .createHash("sha256")
    .update(original)
    .digest("hex");
  const restoredSha256 = crypto
    .createHash("sha256")
    .update(restored)
    .digest("hex");
  return {
    algorithm,
    originalSize: original.length,
    compressedSize: encoded.length,
    ...computeMetrics(original.length, encoded.length),
    encodeTimeMs,
    decodeTimeMs,
    verified: restored.equals(original),
    originalSha256,
    restoredSha256,
    output: encoded,
    huffman,
  };
}

export function decompressAuto(buffer) {
  const input = Buffer.from(buffer);
  const format =
    input.toString("ascii", 0, 4) === "HUF1"
      ? "huffman"
      : input.toString("ascii", 0, 4) === "RLE1"
        ? "rle"
        : null;
  if (!format) throw new (class extends Error {})("Unknown compression format");
  const start = process.hrtime.bigint();
  const restored =
    format === "huffman" ? huffmanDecode(input) : rleDecode(input);
  return {
    format,
    restored,
    decodeTimeMs: Number(process.hrtime.bigint() - start) / 1e6,
    sha256: crypto.createHash("sha256").update(restored).digest("hex"),
  };
}

export function traceCompression(buffer, algorithm) {
  const steps = [];
  const emit = (phase, title, state) =>
    steps.push({
      id: steps.length + 1,
      phase,
      title,
      explanation:
        phase === "count"
          ? "Scan the sample and record how often each byte occurs."
          : phase === "heap"
            ? "The smallest-frequency node moves into the min-heap."
            : phase === "build-tree"
              ? "Greedy choice: merge the two least-frequent nodes."
              : phase === "assign-codes"
                ? "A left edge is 0 and a right edge is 1."
                : phase === "runs"
                  ? "Consecutive equal bytes form one compact run."
                  : "The decoder restores the original bytes.",
      concept: phase === "build-tree" ? "Greedy choice" : phase,
      pseudoLine: steps.length + 1,
      ops: { comparisons: steps.length, heapOps: phase === "heap" || phase === "build-tree" ? 1 : 0 },
      state,
    });
  let encoded;
  let decoded;
  if (algorithm === "huffman") {
    encoded = huffmanEncode(buffer, { tracer: emit }).output;
    decoded = huffmanDecode(encoded, { tracer: emit });
  } else {
    encoded = rleEncode(buffer, { tracer: emit });
    decoded = rleDecode(encoded, { tracer: emit });
  }
  emit("verify", "Verify the decoded sample", {
    original: [...buffer],
    restored: [...decoded],
    verified: decoded.equals(Buffer.from(buffer)),
  });
  return { encoded, decoded, steps };
}
