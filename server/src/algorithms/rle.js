import { CorruptDataError } from "./errors.js";

export function rleEncode(input, { tracer } = {}) {
  const buffer = Buffer.from(input);
  const output = [Buffer.from("RLE1")];
  let index = 0;
  while (index < buffer.length) {
    const value = buffer[index];
    let count = 1;
    while (
      index + count < buffer.length &&
      buffer[index + count] === value &&
      count < 255
    )
      count++;
    output.push(Buffer.from([count, value]));
    tracer?.("runs", "Emit a run-length pair", {
      count,
      value,
      inputBytes: index + count,
      outputBytes: output.reduce((sum, part) => sum + part.length, 0),
    });
    index += count;
  }
  return Buffer.concat(output);
}

export function rleDecode(input, { tracer } = {}) {
  const buffer = Buffer.from(input);
  if (buffer.length < 4 || buffer.toString("ascii", 0, 4) !== "RLE1")
    throw new CorruptDataError("Invalid RLE magic header");
  if ((buffer.length - 4) % 2)
    throw new CorruptDataError("RLE payload has an odd length");
  let size = 0;
  for (let i = 4; i < buffer.length; i += 2) {
    const count = buffer[i];
    if (!count) throw new CorruptDataError("RLE run count cannot be zero");
    size += count;
    if (size > 100 * 1024 * 1024)
      throw new CorruptDataError("RLE output exceeds the 100 MB safety limit");
  }
  const output = Buffer.alloc(size);
  let offset = 0;
  for (let i = 4; i < buffer.length; i += 2) {
    const count = buffer[i];
    output.fill(buffer[i + 1], offset, offset + count);
    offset += count;
    tracer?.("decode", "Restore a run from a pair", {
      count,
      value: buffer[i + 1],
      restoredBytes: offset,
    });
  }
  return output;
}
