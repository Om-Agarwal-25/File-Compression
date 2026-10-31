import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMetrics,
  compressWithVerification,
} from "../src/algorithms/index.js";

test("metrics handle empty and expansion", () => {
  assert.deepEqual(computeMetrics(0, 4), { ratio: null, spaceSavedPercent: 0 });
  assert.equal(computeMetrics(1, 2).spaceSavedPercent, -100);
});
test("both algorithms verify exact output", () => {
  for (const algorithm of ["huffman", "rle"]) {
    const result = compressWithVerification(
      Buffer.from("aaaaabbbcc"),
      algorithm,
    );
    assert.equal(result.verified, true);
    assert.equal(result.originalSize, 10);
    assert.equal(result.compressedSize, result.output.length);
  }
});
