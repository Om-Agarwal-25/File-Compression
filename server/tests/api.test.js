import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../src/index.js";

let server;
let limitedServer;
let base;
let limitedBase;
test.before(async () => {
  server = createServer(createApp({ maxFileMB: 10 }));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
  limitedServer = createServer(createApp({ maxFileMB: 1 }));
  await new Promise((resolve) => limitedServer.listen(0, resolve));
  limitedBase = `http://localhost:${limitedServer.address().port}`;
});
test.after(() => {
  server.close();
  limitedServer.close();
});

function form(file, fields = {}) {
  const body = new FormData();
  body.append("file", new Blob([file]), "sample.bin");
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return body;
}
async function json(response) {
  return response.json();
}

test("health and disabled history", async () => {
  const health = await json(await fetch(`${base}/api/health`));
  assert.equal(health.ok, true);
  assert.equal(health.database, "disabled");
  assert.deepEqual(
    (await json(await fetch(`${base}/api/history`))).records,
    [],
  );
});
test("compress compare and decompress round trip", async () => {
  const input = Buffer.from("aaaaabbbbccccdd");
  for (const algorithm of ["huffman", "rle"]) {
    const compressed = await json(
      await fetch(`${base}/api/compress`, {
        method: "POST",
        body: form(input, { algorithm }),
      }),
    );
    assert.equal(compressed.verified, true);
    const restored = await json(
      await fetch(`${base}/api/decompress`, {
        method: "POST",
        body: form(Buffer.from(compressed.compressedBase64, "base64")),
      }),
    );
    assert.equal(restored.ok, true);
    assert.deepEqual(Buffer.from(restored.restoredBase64, "base64"), input);
  }
  const compared = await json(
    await fetch(`${base}/api/compare`, { method: "POST", body: form(input) }),
  );
  assert.equal(compared.ok, true);
  assert.ok(compared.results.huffman && compared.results.rle);
});
test("trace returns replayable encode and decode steps", async () => {
  const response = await fetch(`${base}/api/trace`, {
    method: "POST",
    body: form(Buffer.from("ABRACADABRA"), {
      algorithm: "huffman",
      sampleSize: "32",
    }),
  });
  const data = await json(response);
  assert.equal(data.ok, true);
  assert.equal(data.sample.usedSize, 11);
  assert.equal(data.summary.verified, true);
  assert.ok(data.encode.steps.length > 0);
  assert.ok(data.decode.steps.length > 0);
  const ids = [...data.encode.steps, ...data.decode.steps].map((step) => step.id);
  assert.deepEqual(ids, ids.map((_, index) => index + 1));
});
test("API returns controlled errors", async () => {
  assert.equal(
    (
      await fetch(`${base}/api/compress`, {
        method: "POST",
        body: new FormData(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(`${base}/api/compress`, {
        method: "POST",
        body: form(Buffer.from("x"), { algorithm: "bad" }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(`${base}/api/decompress`, {
        method: "POST",
        body: form(Buffer.from("bad")),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(`${limitedBase}/api/compress`, {
        method: "POST",
        body: form(Buffer.alloc(2 * 1024 * 1024), { algorithm: "rle" }),
      })
    ).status,
    413,
  );
});
