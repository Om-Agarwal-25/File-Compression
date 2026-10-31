function byteLabel(byte) {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : `0x${byte.toString(16).padStart(2, "0")}`;
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeStep(phase, title, explanation, concept, state) {
  return { phase, title, explanation, concept, state: snapshot(state) };
}

function huffmanSteps(bytes) {
  const frequencies = new Map();
  const steps = [];
  for (let index = 0; index < bytes.length; index += 1) {
    frequencies.set(bytes[index], (frequencies.get(bytes[index]) || 0) + 1);
    steps.push(makeStep("count", `Count byte ${byteLabel(bytes[index])}`, `${index + 1} of ${bytes.length} bytes scanned.`, "Frequency analysis", {
      bytes: [...bytes], pointer: index, frequencies: [...frequencies].map(([byte, frequency]) => ({ byte, frequency })),
    }));
  }
  let heap = [...frequencies].map(([byte, frequency]) => ({ byte, frequency }));
  heap.sort((a, b) => a.frequency - b.frequency || a.byte - b.byte);
  for (let index = 0; index < heap.length; index += 1) {
    steps.push(makeStep("heap", `Insert ${byteLabel(heap[index].byte)}`, "The least-frequency item rises into the min-heap.", "Min-heap", {
      heap: heap.map((node) => ({ ...node })), inserted: heap[index].byte,
    }));
  }
  const forest = heap.map((node) => ({ ...node }));
  while (heap.length > 1) {
    heap.sort((a, b) => a.frequency - b.frequency || (a.byte ?? 999) - (b.byte ?? 999));
    const left = heap.shift();
    const right = heap.shift();
    const node = { frequency: left.frequency + right.frequency, left, right };
    heap.push(node);
    forest.push(node);
    steps.push(makeStep("build", `Merge ${left.frequency} + ${right.frequency}`, "Always combine the two least-frequent trees.", "Greedy choice", {
      heap: heap.map((item) => ({ frequency: item.frequency, byte: item.byte })),
      left, right, merged: node, forest: forest.slice(-Math.min(8, forest.length)),
    }));
  }
  const root = heap[0];
  const codes = new Map();
  function walk(node, code = "") {
    if (node.byte !== undefined) {
      codes.set(node.byte, code || "0");
      return;
    }
    walk(node.left, `${code}0`);
    walk(node.right, `${code}1`);
  }
  walk(root);
  for (const [byte, code] of codes) {
    steps.push(makeStep("codes", `Assign ${byteLabel(byte)} → ${code}`, "Each leaf receives its root-to-leaf prefix.", "Prefix-free code", {
      tree: root, codes: [...codes].map(([symbol, value]) => ({ byte: symbol, code: value })), active: byte,
    }));
  }
  let bitstream = "";
  for (let index = 0; index < bytes.length; index += 1) {
    bitstream += codes.get(bytes[index]);
    steps.push(makeStep("encode", `Encode ${byteLabel(bytes[index])}`, "Append the symbol's variable-length code to the bitstream.", "Variable-length encoding", {
      bytes: [...bytes], pointer: index, bitstream, originalBits: (index + 1) * 8, encodedBits: bitstream.length,
    }));
  }
  const decoded = [];
  let node = root;
  for (let index = 0; index < bitstream.length; index += 1) {
    node = bitstream[index] === "0" ? node.left : node.right;
    if (node.byte !== undefined) {
      decoded.push(node.byte);
      node = root;
    }
    steps.push(makeStep("decode", "Walk the prefix tree", node.byte === undefined ? "Follow one bit toward the next leaf." : `Restore ${byteLabel(decoded[decoded.length - 1])} and return to the root.`, "Prefix-free decoding", {
      bitstream, bitPointer: index, decoded: [...decoded], node,
    }));
  }
  steps.push(makeStep("decode", "Lossless ✓", "The decoded bytes match the sample exactly.", "Verification", { bytes: [...bytes], decoded }));
  return steps;
}

function rleSteps(bytes) {
  const steps = [];
  const pairs = [];
  let index = 0;
  while (index < bytes.length) {
    const value = bytes[index];
    let count = 1;
    while (index + count < bytes.length && bytes[index + count] === value && count < 255) count += 1;
    pairs.push({ count, value });
    steps.push(makeStep("scan", `Find run of ${byteLabel(value)}`, `${count} equal byte${count === 1 ? "" : "s"} grouped together.`, "Run detection", { bytes: [...bytes], start: index, end: index + count - 1, pairs: [...pairs] }));
    index += count;
  }
  steps.push(makeStep("pairs", "Emit compact pairs", "Each run becomes a count and a byte value.", "Run-Length Encoding", { bytes: [...bytes], pairs }));
  const decoded = [];
  pairs.forEach((pair) => {
    decoded.push(...Array(pair.count).fill(pair.value));
    steps.push(makeStep("decode", `Expand (${pair.count}, ${byteLabel(pair.value)})`, "The pair restores its repeated bytes.", "Lossless decoding", { pairs, decoded: [...decoded] }));
  });
  return steps;
}

export function makeDemoSteps(input, algorithm) {
  const source = Array.from(input).slice(0, 64);
  return algorithm === "rle" ? rleSteps(source) : huffmanSteps(source);
}

export { byteLabel };
