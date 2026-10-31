import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    fileName: String,
    algorithm: { type: String, enum: ["huffman", "rle"] },
    originalSize: Number,
    compressedSize: Number,
    ratio: Number,
    spaceSavedPercent: Number,
    encodeTimeMs: Number,
    decodeTimeMs: Number,
    verified: Boolean,
  },
  { timestamps: true },
);

export default mongoose.models.CompressionHistory ||
  mongoose.model("CompressionHistory", schema);
