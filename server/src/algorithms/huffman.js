import { CorruptDataError } from "./errors.js";

export class MinHeap {
  #items = [];
  push(item) {
    this.#items.push(item);
    let i = this.#items.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (compareNodes(this.#items[parent], item) <= 0) break;
      this.#items[i] = this.#items[parent];
      i = parent;
    }
    this.#items[i] = item;
  }
  pop() {
    if (!this.#items.length) return undefined;
    const result = this.#items[0];
    const last = this.#items.pop();
    if (this.#items.length && last) {
      let i = 0;
      while (true) {
        let child = i * 2 + 1;
        if (child >= this.#items.length) break;
        if (
          child + 1 < this.#items.length &&
          compareNodes(this.#items[child + 1], this.#items[child]) < 0
        )
          child++;
        if (compareNodes(this.#items[child], last) >= 0) break;
        this.#items[i] = this.#items[child];
        i = child;
      }
      this.#items[i] = last;
    }
    return result;
  }
  size() {
    return this.#items.length;
  }
  items() {
    return [...this.#items];
  }
}

function compareNodes(a, b) {
  return a.frequency - b.frequency || a.order - b.order;
}

function snapshotHeap(heap) {
  return heap.items().map((node) => ({
    frequency: node.frequency,
    ...(node.byte === undefined ? {} : { byte: node.byte }),
  }));
}

function buildTree(frequencies, tracer) {
  const heap = new MinHeap();
  let order = 0;
  for (let byte = 0; byte < 256; byte++) {
    if (frequencies[byte]) {
      const node = { frequency: frequencies[byte], byte, order: order++ };
      heap.push(node);
      tracer?.("heap", "Push symbol into min-heap", {
        heap: snapshotHeap(heap),
      });
    }
  }
  if (!heap.size()) return null;
  while (heap.size() > 1) {
    const left = heap.pop();
    const right = heap.pop();
    const merged = {
      frequency: left.frequency + right.frequency,
      left,
      right,
      order: order++,
    };
    heap.push(merged);
    tracer?.("build-tree", "Merge the two smallest nodes", {
      left: left.byte,
      right: right.byte,
      frequency: merged.frequency,
      heap: snapshotHeap(heap),
    });
  }
  return heap.pop();
}

function displayByte(byte) {
  if (byte === 0x20) return "0x20 (space)";
  if (byte >= 0x21 && byte <= 0x7e) return String.fromCharCode(byte);
  return `0x${byte.toString(16).padStart(2, "0")}`;
}

function makeDetails(root, frequencies, codes) {
  const tree = root ? serializeTree(root) : null;
  const entries = [];
  let weighted = 0;
  for (let byte = 0; byte < 256; byte++) {
    if (frequencies[byte]) {
      const code = codes[byte];
      entries.push({
        byte,
        display: displayByte(byte),
        frequency: frequencies[byte],
        code,
        length: code.length,
      });
      weighted += frequencies[byte] * code.length;
    }
  }
  return {
    codes: entries,
    tree,
    distinctSymbols: entries.length,
    averageCodeLength:
      frequencies.reduce(
        (sum, frequency, byte) => sum + frequency * (codes[byte]?.length || 0),
        0,
      ) / (frequencies.reduce((sum, frequency) => sum + frequency, 0) || 1),
    headerBytes: 1032,
  };
}

function serializeTree(node) {
  const result = { frequency: node.frequency };
  if (node.byte !== undefined) {
    result.byte = node.byte;
    result.display = displayByte(node.byte);
  } else {
    result.left = serializeTree(node.left);
    result.right = serializeTree(node.right);
  }
  return result;
}

function createCodes(root, tracer) {
  const codes = Array(256);
  if (!root) return codes;
  if (root.byte !== undefined) {
    codes[root.byte] = "0";
    return codes;
  }
  const stack = [{ node: root, code: "" }];
  while (stack.length) {
    const { node, code } = stack.pop();
    if (node.byte !== undefined) {
      codes[node.byte] = code;
      tracer?.("assign-codes", "Assign a prefix-free code", {
        byte: node.byte,
        code,
      });
    } else {
      stack.push({ node: node.right, code: `${code}1` });
      stack.push({ node: node.left, code: `${code}0` });
    }
  }
  return codes;
}

export function huffmanEncode(input, { tracer } = {}) {
  const buffer = Buffer.from(input);
  const frequencies = new Uint32Array(256);
  for (const byte of buffer) frequencies[byte]++;
  tracer?.("count", "Count byte frequencies", {
    frequencies: [...frequencies]
      .map((frequency, byte) => ({ byte, frequency }))
      .filter((item) => item.frequency),
  });
  const root = buildTree(frequencies, tracer);
  const codes = createCodes(root, tracer);
  const payloadBytes = buffer.length
    ? Math.ceil(
        [...buffer].reduce((sum, byte) => sum + codes[byte].length, 0) / 8,
      )
    : 0;
  const output = Buffer.alloc(1032 + payloadBytes);
  output.write("HUF1", 0, "ascii");
  output.writeUInt32BE(buffer.length, 4);
  for (let byte = 0; byte < 256; byte++)
    output.writeUInt32BE(frequencies[byte], 8 + byte * 4);
  let bitIndex = 0;
  for (const byte of buffer) {
    for (const bit of codes[byte]) {
      if (bit === "1")
        output[1032 + Math.floor(bitIndex / 8)] |= 1 << (7 - (bitIndex % 8));
      bitIndex++;
    }
    tracer?.("pack", "Pack the encoded bits into bytes", {
      encodedBits: bitIndex,
      payloadBytes,
      output: [...output],
    });
  }
  return {
    output,
    details: { ...makeDetails(root, frequencies, codes), payloadBytes },
  };
}

export function huffmanDecode(input, { tracer } = {}) {
  const buffer = Buffer.from(input);
  if (buffer.length < 1032)
    throw new CorruptDataError("Huffman data is truncated");
  if (buffer.toString("ascii", 0, 4) !== "HUF1")
    throw new CorruptDataError("Invalid Huffman magic header");
  const originalSize = buffer.readUInt32BE(4);
  const frequencies = new Uint32Array(256);
  let total = 0;
  for (let byte = 0; byte < 256; byte++) {
    frequencies[byte] = buffer.readUInt32BE(8 + byte * 4);
    total += frequencies[byte];
  }
  if (total !== originalSize)
    throw new CorruptDataError(
      "Huffman frequency table does not match original size",
    );
  if (!originalSize) return Buffer.alloc(0);
  const root = buildTree(frequencies);
  const expectedBits =
    root.byte !== undefined
      ? originalSize
      : [...frequencies].reduce(
          (sum, frequency, byte) =>
            sum + frequency * (createCodes(root)[byte]?.length || 0),
          0,
        );
  if (buffer.length - 1032 < Math.ceil(expectedBits / 8))
    throw new CorruptDataError("Huffman payload is truncated");
  if (root.byte !== undefined) return Buffer.alloc(originalSize, root.byte);
  const restored = Buffer.alloc(originalSize);
  let produced = 0;
  let node = root;
  for (let i = 0; i < expectedBits && produced < originalSize; i++) {
    const bit = (buffer[1032 + Math.floor(i / 8)] >> (7 - (i % 8))) & 1;
    node = bit ? node.right : node.left;
    if (!node) throw new CorruptDataError("Invalid Huffman bitstream");
    if (node.byte !== undefined) {
      restored[produced++] = node.byte;
      tracer?.("decode", "Reach a leaf and restore a byte", {
        byte: node.byte,
        produced,
        bitsRead: i + 1,
      });
      node = root;
    }
  }
  if (produced !== originalSize)
    throw new CorruptDataError(
      "Huffman payload ended before restoring the file",
    );
  return restored;
}
