import test from "node:test";
import assert from "node:assert/strict";
import { rleEncode, rleDecode } from "../src/algorithms/rle.js";

test("RLE handles required byte cases", () => {
  for (const input of [
    Buffer.alloc(0),
    Buffer.from([7]),
    Buffer.alloc(300, 65),
    Buffer.from("ABABAB"),
    Buffer.from([...Array(256).keys()]),
  ]) {
    assert.deepEqual(rleDecode(rleEncode(input)), input);
  }
  const encoded = rleEncode(Buffer.alloc(300, 88));
  assert.deepEqual([...encoded.slice(4)], [255, 88, 45, 88]);
  const random = Buffer.from(
    Array.from({ length: 10000 }, () => Math.floor(Math.random() * 256)),
  );
  assert.deepEqual(rleDecode(rleEncode(random)), random);
});

test("RLE rejects corrupt input", () => {
  assert.throws(() => rleDecode(Buffer.from("BAD1")), /magic/i);
  assert.throws(() => rleDecode(Buffer.from([82, 76, 69, 49, 1])), /odd/i);
  assert.throws(() => rleDecode(Buffer.from([82, 76, 69, 49, 0, 1])), /zero/i);
  assert.throws(
    () =>
      rleDecode(
        Buffer.concat([Buffer.from("RLE1"), Buffer.alloc(420000 * 2, 0xff)]),
      ),
    /100 MB/i,
  );
});
