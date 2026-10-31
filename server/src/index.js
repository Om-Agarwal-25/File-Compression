import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  compressWithVerification,
  decompressAuto,
  CorruptDataError,
  traceCompression,
} from "./algorithms/index.js";
import CompressionHistory from "./models/CompressionHistory.js";

function numberEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resultJson(result, fileName) {
  return {
    fileName,
    algorithm: result.algorithm,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    ratio: result.ratio,
    spaceSavedPercent: result.spaceSavedPercent,
    encodeTimeMs: Number(result.encodeTimeMs.toFixed(3)),
    decodeTimeMs: Number(result.decodeTimeMs.toFixed(3)),
    verified: result.verified,
    originalSha256: result.originalSha256,
    restoredSha256: result.restoredSha256,
    outputFileName: `${fileName}.${result.algorithm === "huffman" ? "huf" : "rle"}`,
    compressedBase64: result.output.toString("base64"),
    ...(result.huffman ? { huffman: result.huffman } : {}),
  };
}

export function createApp(options = {}) {
  const maxFileMB = options.maxFileMB || numberEnv(process.env.MAX_FILE_MB, 10);
  const state = { database: options.database || "disabled" };
  const app = express();
  app.use(
    cors({
      origin:
        options.clientOrigin ||
        process.env.CLIENT_ORIGIN ||
        "http://localhost:5173",
    }),
  );
  app.use(express.json());
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileMB * 1024 * 1024 },
  });
  const uploadSingle = (request, response, next) =>
    upload.single("file")(request, response, next);
  const requireFile = (request, response, next) => {
    if (!request.file)
      return next(
        new CorruptDataError(
          'No file uploaded. Attach a file in the "file" field.',
        ),
      );
    next();
  };
  const saveHistory = (result, fileName) => {
    if (state.database !== "connected") return;
    CompressionHistory.create({
      fileName,
      algorithm: result.algorithm,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      ratio: result.ratio,
      spaceSavedPercent: result.spaceSavedPercent,
      encodeTimeMs: result.encodeTimeMs,
      decodeTimeMs: result.decodeTimeMs,
      verified: result.verified,
    }).catch((error) =>
      console.warn("Could not save compression history:", error.message),
    );
  };

  app.get("/api/health", (request, response) =>
    response.json({ ok: true, database: state.database, maxFileMB }),
  );
  app.post(
    "/api/trace",
    uploadSingle,
    (request, response, next) => {
      try {
        const algorithm = request.body.algorithm;
        if (!["huffman", "rle"].includes(algorithm))
          throw new CorruptDataError('Algorithm must be "huffman" or "rle".');
        const source = request.file
          ? Buffer.from(request.file.buffer)
          : Buffer.from(String(request.body.text || ""), "utf8");
        const requested = Math.max(8, Math.min(256, Number(request.body.sampleSize) || 32));
        const bytes = source.subarray(0, requested);
        const sample = bytes.length
          ? bytes.subarray(
              0,
              [...new Set(bytes)].length <= 24
                ? bytes.length
                : [...bytes].findIndex((_, index) => [...new Set(bytes.subarray(0, index + 1))].length > 24),
            )
          : bytes;
        const traced = traceCompression(sample, algorithm);
        const payloadBytes = algorithm === "huffman" ? Math.max(0, traced.encoded.length - 1032) : traced.encoded.length - 4;
        const packStep = traced.steps.findLast?.((step) => step.phase === "pack");
        const encodedBits = packStep?.state.encodedBits ?? payloadBytes * 8;
        response.json({
          ok: true,
          algorithm,
          sample: {
            bytes: [...sample],
            usedSize: sample.length,
            totalSize: source.length,
            distinct: new Set(sample).size,
            truncatedToFit: sample.length !== bytes.length,
            source: request.file ? "file" : "text",
          },
          encode: { steps: traced.steps.filter((step) => step.phase !== "decode" && step.phase !== "verify") },
          decode: { steps: traced.steps.filter((step) => step.phase === "decode" || step.phase === "verify") },
          summary: {
            originalBits: sample.length * 8,
            encodedBits,
            headerBytes: algorithm === "huffman" ? 1032 : 4,
            payloadBytes,
            ratioIgnoringHeader: payloadBytes ? sample.length / payloadBytes : null,
            ratioWithHeader: traced.encoded.length ? sample.length / traced.encoded.length : null,
            verified: traced.decoded.equals(sample),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post(
    "/api/compress",
    uploadSingle,
    requireFile,
    (request, response, next) => {
      try {
        const algorithm = request.body.algorithm;
        if (!["huffman", "rle"].includes(algorithm))
          throw new CorruptDataError('Algorithm must be "huffman" or "rle".');
        const result = compressWithVerification(request.file.buffer, algorithm);
        saveHistory(result, request.file.originalname);
        response.json({
          ok: true,
          ...resultJson(result, request.file.originalname),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post(
    "/api/compare",
    uploadSingle,
    requireFile,
    (request, response, next) => {
      try {
        const huffman = compressWithVerification(
          request.file.buffer,
          "huffman",
        );
        const rle = compressWithVerification(request.file.buffer, "rle");
        saveHistory(huffman, request.file.originalname);
        saveHistory(rle, request.file.originalname);
        const bestBySize =
          huffman.compressedSize === rle.compressedSize
            ? "tie"
            : huffman.compressedSize < rle.compressedSize
              ? "huffman"
              : "rle";
        const fastestEncode =
          huffman.encodeTimeMs <= rle.encodeTimeMs ? "huffman" : "rle";
        response.json({
          ok: true,
          fileName: request.file.originalname,
          originalSize: request.file.size,
          results: {
            huffman: resultJson(huffman, request.file.originalname),
            rle: resultJson(rle, request.file.originalname),
          },
          bestBySize,
          fastestEncode,
        });
      } catch (error) {
        next(error);
      }
    },
  );
  app.post(
    "/api/decompress",
    uploadSingle,
    requireFile,
    (request, response, next) => {
      try {
        const result = decompressAuto(request.file.buffer);
        const originalName = request.file.originalname;
        const restoredFileName = /\.(huf|rle)$/i.test(originalName)
          ? originalName.replace(/\.(huf|rle)$/i, "")
          : `restored_${originalName}`;
        response.json({
          ok: true,
          format: result.format,
          compressedSize: request.file.size,
          restoredSize: result.restored.length,
          decodeTimeMs: Number(result.decodeTimeMs.toFixed(3)),
          sha256: result.sha256,
          restoredFileName,
          restoredBase64: result.restored.toString("base64"),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  app.get("/api/history", async (request, response, next) => {
    try {
      if (state.database !== "connected")
        return response.json({ ok: true, database: "disabled", records: [] });
      const records = await CompressionHistory.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      response.json({ ok: true, database: "connected", records });
    } catch (error) {
      next(error);
    }
  });
  app.use((error, request, response, next) => {
    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return response
        .status(413)
        .json({ ok: false, error: `File exceeds the ${maxFileMB} MB limit.` });
    }
    if (
      error instanceof CorruptDataError ||
      /format|algorithm|file uploaded|magic|truncated|payload|frequency|run count/i.test(
        error.message || "",
      )
    ) {
      return response.status(400).json({ ok: false, error: error.message });
    }
    console.error(error);
    response
      .status(500)
      .json({ ok: false, error: "An unexpected server error occurred." });
  });
  app.locals.state = state;
  app.locals.maxFileMB = maxFileMB;
  return app;
}

async function start() {
  const app = createApp();
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) {
    try {
      await mongoose.connect(uri);
      app.locals.state.database = "connected";
    } catch (error) {
      app.locals.state.database = "error";
      console.warn("MongoDB unavailable; history disabled:", error.message);
    }
  }
  const port = numberEnv(process.env.PORT, 5000);
  app.listen(port, () => {
    console.log(`API listening at http://localhost:${port}`);
    console.log(
      `Persistent history ${app.locals.state.database === "connected" ? "enabled" : "disabled"}.`,
    );
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  start();
