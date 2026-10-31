import { downloadBase64, formatBytes } from "../api.js";
export default function ResultCard({ result, onDownload }) {
  const positive = result.spaceSavedPercent >= 0;
  return (
    <article className="card result-card">
      <div className="card-title">
        <h3>
          {result.algorithm === "huffman"
            ? "Huffman coding"
            : "Run-Length Encoding"}
        </h3>
        <span className={result.verified ? "badge success" : "badge danger"}>
          {result.verified ? "Verified ✓" : "Failed ✗"}
        </span>
      </div>
      <div className="metrics">
        <span>
          Original<strong>{formatBytes(result.originalSize)}</strong>
        </span>
        <span>
          Compressed<strong>{formatBytes(result.compressedSize)}</strong>
        </span>
        <span>
          Ratio
          <strong>
            {result.ratio == null ? "N/A" : result.ratio.toFixed(2)}x
          </strong>
        </span>
        <span>
          Saved
          <strong className={positive ? "positive" : "negative"}>
            {result.spaceSavedPercent.toFixed(1)}%{" "}
            {positive ? "" : "(expanded)"}
          </strong>
        </span>
        <span>
          Encode<strong>{result.encodeTimeMs.toFixed(2)} ms</strong>
        </span>
        <span>
          Decode<strong>{result.decodeTimeMs.toFixed(2)} ms</strong>
        </span>
      </div>
      <small>
        SHA-256: {result.originalSha256.slice(0, 16)}...{" "}
        <button
          className="text-button"
          onClick={() => navigator.clipboard?.writeText(result.originalSha256)}
        >
          copy
        </button>
      </small>
      <button
        className="primary"
        onClick={() =>
          (onDownload || downloadBase64)(
            result.compressedBase64,
            result.outputFileName,
          )
        }
      >
        Download compressed
      </button>
    </article>
  );
}
