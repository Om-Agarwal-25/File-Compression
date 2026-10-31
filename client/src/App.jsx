import { useEffect, useState } from "react";
import {
  compare,
  compress,
  decompress,
  downloadBase64,
  formatBytes,
  getHealth,
  getHistory,
} from "./api.js";
import Visualizer from "./components/Visualizer.jsx";
import ResultPanel from "./components/ResultPanel.jsx";

const tabs = ["Compress", "Visualizer", "Decompress", "History", "Learn"];
function FileDrop({ onFile, file, max }) {
  return (
    <label
      className="drop-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFile(event.dataTransfer.files[0]);
      }}
    >
      <input type="file" onChange={(event) => onFile(event.target.files[0])} />{" "}
      <strong>{file ? file.name : "Drop a file here or choose one"}</strong>
      {file && <span>{formatBytes(file.size)}</span>}
      {file && max && file.size > max * 1024 * 1024 && (
        <em>File exceeds the server limit.</em>
      )}
    </label>
  );
}
function Kpis({ result, compare }) {
  const items = compare
    ? [compare.huffman, compare.rle]
    : [result];
  return <div className="kpi-row">{items.map((item) => <div className="kpi-card" key={item.algorithm}><small>{item.algorithm}</small><b>{formatBytes(item.compressedSize)}</b><span className={item.spaceSavedPercent >= 0 ? "positive" : "negative"}>{item.spaceSavedPercent.toFixed(1)}% {item.spaceSavedPercent < 0 && "expanded"}</span><em>{item.verified ? "Verified ✓" : "Failed ✗"}</em></div>)}{!compare && <div className="kpi-card"><small>Original</small><b>{formatBytes(result.originalSize)}</b><span>Saved target</span><em>{result.verified ? "Verified ✓" : "Failed ✗"}</em></div>}</div>;
}
function Learn() {
  const rows = [
    ["Frequency counting", "O(n)", "O(k)"],
    ["Build Huffman tree", "O(k log k)", "O(k)"],
    ["Generate codes", "O(k)", "O(k)"],
    ["Huffman encode", "O(n + B)", "O(B)"],
    ["Huffman decode", "O(c + n)", "O(n + k)"],
    ["RLE encode", "O(n)", "O(n) worst case"],
    ["RLE decode", "O(m + n)", "O(n)"],
    ["Hash + exact verify", "O(n)", "O(n)"],
  ];
  return (
    <section className="card learn">
      <h2>Learn / complexity</h2>
      <div className="learn-grid">
        <div>
          <h3>Huffman</h3>
          <p>
            Count byte frequencies, repeatedly make the greedy choice of the two
            least frequent nodes with a min-heap, then assign prefix-free 0/1
            codes. The header preserves the frequency table so decoding rebuilds
            the same tree.
          </p>
        </div>
        <div>
          <h3>RLE</h3>
          <p>
            Scan forward and replace each consecutive run with a count and byte.
            Counts cap at 255, so arbitrary binary data remains safe and
            lossless.
          </p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Operation</th>
            <th>Time</th>
            <th>Space</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td key={`${row[0]}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Tiny inputs can expand: Huffman has a fixed 1,032-byte header and RLE
        can turn a one-byte run into two bytes. A single run is not a rigorous
        benchmark.
      </p>
    </section>
  );
}
export default function App() {
  const [tab, setTab] = useState("Compress");
  const [file, setFile] = useState(null);
  const [algorithm, setAlgorithm] = useState("huffman");
  const [health, setHealth] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("bytewise-theme") === "dark");
  const [history, setHistory] = useState(null);
  const refreshHealth = () =>
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  useEffect(() => {
    refreshHealth();
    const timer = setInterval(refreshHealth, 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("bytewise-theme", dark ? "dark" : "light");
  }, [dark]);
  async function run() {
    if (!file) return setError("Choose a file first.");
    setError("");
    setLoading(true);
    try {
      setResult(
        algorithm === "compare"
          ? await compare(file)
          : await compress(file, algorithm),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function loadHistory() {
    setError("");
    try {
      setHistory(await getHistory());
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (tab === "History") loadHistory();
  }, [tab]);
  return (
    <div className="app">
      <header>
        <div>
          <div className="eyebrow">DAA laboratory</div>
          <h1>ByteWise</h1>
        </div>
        <div className={health ? "status online" : "status"}>
          <span />
          {health
            ? `Online · DB ${health.database} · ${health.maxFileMB} MB`
            : "Offline"}
        </div>
        <button className="theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme">
          {dark ? "Light" : "Dark"}
        </button>
      </header>
      <nav aria-label="Main navigation">
        {tabs.map((item) => (
          <button
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </nav>
      <main>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {tab === "Compress" && (
          <>
            <section className="hero">
              <h2>Compress any file, understand every byte.</h2>
              <p>
                Compare two hand-built lossless algorithms with server-side
                exact verification.
              </p>
            </section>
            <section className="card controls">
              <FileDrop file={file} onFile={setFile} max={health?.maxFileMB} />
              <label>
                Algorithm
                <select
                  value={algorithm}
                  onChange={(event) => setAlgorithm(event.target.value)}
                >
                  <option value="huffman">Huffman coding</option>
                  <option value="rle">Run-Length Encoding</option>
                  <option value="compare">Compare both</option>
                </select>
              </label>
              <button className="primary run" disabled={loading} onClick={run}>
                {loading ? "Running…" : "Run compression"}
              </button>
              <button className="secondary" disabled={!file} onClick={() => setTab("Visualizer")}>
                Visualize how it works
              </button>
            </section>
            {result?.results ? <><Kpis compare={result.results} /><ResultPanel compare={result.results} /></> : result && <><Kpis result={result} /><ResultPanel result={result} /></>}
          </>
        )}
        {tab === "Visualizer" && (
          <Visualizer file={file} initialAlgorithm={algorithm} onError={setError} />
        )}
        {tab === "Decompress" && <DecompressView onError={setError} />}
        {tab === "History" && (
          <section className="card">
            <div className="card-title">
              <h2>Recent history</h2>
              <button className="secondary" onClick={loadHistory}>
                Refresh
              </button>
            </div>
            {history?.database === "disabled" ? (
              <p>
                History is optional and currently disabled. Set{" "}
                <code>MONGODB_URI</code> on the server to enable it.
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Algorithm</th>
                      <th>Original</th>
                      <th>Compressed</th>
                      <th>Saved</th>
                      <th>Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history?.records.map((item) => (
                      <tr key={item._id}>
                        <td>{item.fileName}</td>
                        <td>{item.algorithm}</td>
                        <td>{formatBytes(item.originalSize)}</td>
                        <td>{formatBytes(item.compressedSize)}</td>
                        <td>{item.spaceSavedPercent.toFixed(1)}%</td>
                        <td>{item.verified ? "✓" : "✗"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {tab === "Learn" && <Learn />}
      </main>
    </div>
  );
}
function DecompressView({ onError }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    if (!file) return onError("Choose a compressed .huf or .rle file first.");
    onError("");
    setLoading(true);
    try {
      setResult(await decompress(file));
    } catch (e) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="card">
      <h2>Decompress</h2>
      <FileDrop file={file} onFile={setFile} />
      <button className="primary" disabled={loading} onClick={run}>
        {loading ? "Restoring…" : "Restore file"}
      </button>
      {result && (
        <div className="restore">
          <p>
            Detected <b>{result.format}</b> ·{" "}
            {formatBytes(result.compressedSize)} →{" "}
            {formatBytes(result.restoredSize)} ·{" "}
            {result.decodeTimeMs.toFixed(2)} ms
          </p>
          <p>
            SHA-256: <code>{result.sha256}</code>
          </p>
          <button
            className="secondary"
            onClick={() =>
              downloadBase64(result.restoredBase64, result.restoredFileName)
            }
          >
            Download restored file
          </button>
        </div>
      )}
    </section>
  );
}
