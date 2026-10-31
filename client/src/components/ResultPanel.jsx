import { useEffect, useMemo, useState } from "react";
import { downloadBase64, formatBytes } from "../api.js";

function Tree({ data }) {
  const [viewBox, setViewBox] = useState(null);
  const [drag, setDrag] = useState(null);
  const codes = Object.fromEntries((data.codes || []).map((item) => [item.byte, item.code]));
  const layout = useMemo(() => {
    const nodes = [];
    let leafIndex = 0;
    let maxDepth = 0;
    const minSpacing = data.codes?.length > 20 ? 14 : 54;
    function measure(node, depth = 0, parent = null, edge = null) {
      if (!node) return null;
      maxDepth = Math.max(maxDepth, depth);
      const item = { node, depth, parent, edge, x: 0, y: depth * 64 + 36 };
      nodes.push(item);
      if (node.byte !== undefined) item.x = leafIndex++ * minSpacing;
      else {
        const left = measure(node.left, depth + 1, item, "0");
        const right = measure(node.right, depth + 1, item, "1");
        item.x = (left.x + right.x) / 2;
      }
      return item;
    }
    measure(data.tree);
    const width = Math.max(360, (leafIndex - 1) * minSpacing + 80);
    nodes.forEach((item) => { item.x += (width - (leafIndex - 1) * minSpacing) / 2; });
    return { nodes, width, height: Math.max(170, maxDepth * 64 + 80), many: leafIndex > 20 };
  }, [data]);
  useEffect(() => {
    setViewBox(null);
  }, [layout.width, layout.height]);
  const box = viewBox || `0 0 ${layout.width} ${layout.height}`;
  function fit() {
    setViewBox(`0 0 ${layout.width} ${layout.height}`);
  }
  function zoom(event) {
    const [x, y, width, height] = box.split(" ").map(Number);
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
    const nextWidth = Math.min(layout.width * 4, Math.max(layout.width * 0.35, width * factor));
    const nextHeight = Math.min(layout.height * 4, Math.max(layout.height * 0.35, height * factor));
    setViewBox(`${x + (width - nextWidth) / 2} ${y + (height - nextHeight) / 2} ${nextWidth} ${nextHeight}`);
  }
  function startDrag(event) {
    setDrag({ x: event.clientX, y: event.clientY, box: box.split(" ").map(Number) });
  }
  function moveDrag(event) {
    if (!drag) return;
    const svg = event.currentTarget.getBoundingClientRect();
    const scaleX = drag.box[2] / svg.width;
    const scaleY = drag.box[3] / svg.height;
    setViewBox(`${drag.box[0] - (event.clientX - drag.x) * scaleX} ${drag.box[1] - (event.clientY - drag.y) * scaleY} ${drag.box[2]} ${drag.box[3]}`);
  }
  function endDrag() {
    setDrag(null);
  }
  return <div className="tree-viewport">
    <div className="tree-controls"><button className="secondary" onClick={fit}>Fit</button><span>Scroll to zoom · drag to pan</span></div>
    <svg className={`result-tree${layout.many ? " many-symbols" : ""}`} viewBox={box} role="img" aria-label="Huffman tree" onWheel={zoom} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerLeave={endDrag}>
      {layout.nodes.filter((item) => item.parent).map((item, index) => <g key={`edge-${index}`}><line className="tree-edge" x1={item.parent.x} y1={item.parent.y + (layout.many ? 5 : 18)} x2={item.x} y2={item.y - (layout.many ? 5 : 18)} />{!layout.many && <text className="edge-label" x={(item.parent.x + item.x) / 2} y={(item.parent.y + item.y) / 2}>{item.edge}</text>}</g>)}
      {layout.nodes.map((item, index) => {
        const leaf = item.node.byte !== undefined;
        const label = leaf ? `${item.node.display}, frequency ${item.node.frequency}, code ${codes[item.node.byte] || ""}` : `Internal node, frequency ${item.node.frequency}`;
        const colorDepth = leaf ? (codes[item.node.byte] || "").length : item.depth;
        return <g className={`${leaf ? "tree-leaf" : "tree-internal"} tree-depth-${Math.min(colorDepth, 5)}`} key={`node-${index}`}><title>{label}</title><circle cx={item.x} cy={item.y} r={layout.many ? 5 : 18} />{!layout.many && <text x={item.x} y={item.y + 4} textAnchor="middle">{leaf ? item.node.display : item.node.frequency}</text>}</g>;
      })}
    </svg>
  </div>;
}

function CodeModal({ codes, onClose }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = codes.filter((item) => `${item.byte} ${item.display} ${item.code}`.toLowerCase().includes(query.toLowerCase()));
  const visible = filtered.slice(page * 15, page * 15 + 15);
  function csv() {
    const body = ["Symbol,Frequency,Code,Bits", ...filtered.map((item) => `${item.byte},${item.frequency},${item.code},${item.length}`)].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "bytewise-codes.csv"; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label="All Huffman codes"><div className="card-title"><h2>All codes</h2><button className="text-button" onClick={onClose}>Close</button></div><div className="modal-actions"><input placeholder="Search symbols" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /><button className="secondary" onClick={csv}>Download CSV</button></div><CodeTable codes={visible} /><div className="pagination"><button className="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / 15))}</span><button className="secondary" disabled={(page + 1) * 15 >= filtered.length} onClick={() => setPage(page + 1)}>Next</button></div></section></div>;
}

function CodeTable({ codes }) {
  return <table className="code-table"><thead><tr><th>Symbol</th><th>Frequency</th><th>Code</th><th>Bits</th></tr></thead><tbody>{codes.map((item) => <tr key={item.byte}><td>{item.display}</td><td>{item.frequency}</td><td><code className="code-chip">{item.code}</code></td><td>{item.length}</td></tr>)}</tbody></table>;
}

export default function ResultPanel({ result, compare }) {
  const [tab, setTab] = useState("Summary");
  const [modal, setModal] = useState(false);
  const primary = compare ? compare.huffman : result;
  const codes = primary?.huffman?.codes || [];
  const top = useMemo(() => [...codes].sort((a, b) => b.frequency - a.frequency).slice(0, 8), [codes]);
  if (!primary) return null;
  const items = compare ? [compare.huffman, compare.rle] : [result];
  return <section className="result-panel card">
    <div className="result-tabs">{["Summary", "Tree", "Codes"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
    {tab === "Summary" && <div className="summary-panel"><div className="comparison-bars">{items.map((item) => <div key={item.algorithm}><span>{item.algorithm} · {formatBytes(item.compressedSize)}</span><i style={{ width: `${Math.min(100, Math.max(4, item.compressedSize / Math.max(1, primary.originalSize) * 100))}%` }} /></div>)}</div><p>{compare ? `Huffman ${compare.huffman.spaceSavedPercent >= 0 ? "saved" : "expanded"} ${Math.abs(compare.huffman.spaceSavedPercent).toFixed(1)}%; RLE ${compare.rle.spaceSavedPercent >= 0 ? "saved" : "expanded"} ${Math.abs(compare.rle.spaceSavedPercent).toFixed(1)}%.` : `${primary.algorithm} ${primary.spaceSavedPercent >= 0 ? "saved" : "expanded"} ${Math.abs(primary.spaceSavedPercent).toFixed(1)}% of the file.`}</p>{primary.huffman && <small className="muted">Header {primary.huffman.headerBytes} B · payload {primary.huffman.payloadBytes} B · average code {primary.huffman.averageCodeLength.toFixed(2)} bits</small>}</div>}
    {tab === "Tree" && (primary.huffman ? <Tree data={primary.huffman} /> : <div className="empty-panel">Tree view is available for Huffman results.</div>)}
    {tab === "Codes" && (codes.length ? <div className="codes-panel"><CodeTable codes={top} /><button className="secondary" onClick={() => setModal(true)}>View all {codes.length}</button></div> : <div className="empty-panel">Run Huffman to inspect codes.</div>)}
    <div className="result-actions"><button className="primary" onClick={() => downloadBase64(primary.compressedBase64, primary.outputFileName)}>Download</button><details><summary>Details</summary><small>Encode {primary.encodeTimeMs.toFixed(2)} ms · Decode {primary.decodeTimeMs.toFixed(2)} ms · SHA-256 {primary.originalSha256.slice(0, 16)}…</small></details></div>
    {modal && <CodeModal codes={codes} onClose={() => setModal(false)} />}
  </section>;
}
