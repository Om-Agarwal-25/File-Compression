import test from "node:test";
import assert from "node:assert/strict";
import {
  huffmanEncode,
  huffmanDecode,
  MinHeap,
} from "../src/algorithms/huffman.js";

test("Huffman round trips edge and binary inputs deterministically", () => {
  const inputs = [
    Buffer.alloc(0),
    Buffer.from([65]),
    Buffer.from("aaabbb"),
    Buffer.from("hello huffman"),
    Buffer.from([...Array(256).keys()]),
  ];
  for (const input of inputs) {
    const first = huffmanEncode(input).output;
    assert.deepEqual(huffmanDecode(first), input);
    assert.deepEqual(huffmanEncode(input).output, first);
    assert.equal(first.toString("ascii", 0, 4), "HUF1");
    assert.equal(
      first.length,
      1032 + (input.length ? huffmanEncode(input).details.payloadBytes : 0),
    );
  }
  const random = Buffer.from(
    Array.from({ length: 1024 * 1024 }, () => Math.floor(Math.random() * 256)),
  );
  assert.deepEqual(huffmanDecode(huffmanEncode(random).output), random);
});

test("Huffman header frequencies and corrupt data validation", () => {
  const input = Buffer.from([1, 1, 2, 3]);
  const encoded = huffmanEncode(input).output;
  assert.equal(encoded.readUInt32BE(12), 2);
  assert.throws(() => huffmanDecode(Buffer.from("bad")), /truncated/i);
  assert.throws(
    () =>
      huffmanDecode(Buffer.concat([Buffer.from("BAD1"), encoded.subarray(4)])),
    /magic/i,
  );
  const mismatch = Buffer.from(encoded);
  mismatch.writeUInt32BE(3, 4);
  assert.throws(() => huffmanDecode(mismatch), /frequency/i);
  assert.throws(() => huffmanDecode(encoded.subarray(0, -1)), /truncated/i);
});

test("heap pops in sorted order", () => {
  const heap = new MinHeap();
  [5, 1, 3, 1].forEach((frequency, order) => heap.push({ frequency, order }));
  assert.deepEqual(
    [
      heap.pop().frequency,
      heap.pop().frequency,
      heap.pop().frequency,
      heap.pop().frequency,
    ],
    [1, 1, 3, 5],
  );
});
