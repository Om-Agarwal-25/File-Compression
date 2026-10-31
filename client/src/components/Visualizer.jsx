import { useEffect, useMemo, useState } from "react";
import { makeDemoSteps, byteLabel } from "../visualizer/steps.js";
import { useStepPlayer } from "../visualizer/useStepPlayer.js";

const presets = ["ABRACADABRA", "AAAAAABBBCCD", "abababab"];
const phaseNames = {
  huffman: [["count", "Count"], ["heap", "Heap"], ["build", "Build tree"], ["codes", "Codes"], ["encode", "Encode"], ["decode", "Decode"]],
  rle: [["scan", "Scan"], ["pairs", "Pairs"], ["decode", "Decode"]],
};

function ByteStrip({ bytes, pointer, start, end }) {
  return <div className="byte-strip">{bytes?.map((byte, index) => <span className={(index === pointer || (start != null && index >= start && index <= end)) ? "byte-cell active" : "byte-cell"} key={`${byte}-${index}`}><b>{byteLabel(byte)}</b><small>{byte.toString(16).padStart(2, "0")}</small></span>)}</div>;
}

function TreeStage({ state, codes }) {
  const tree = state?.tree || state?.merged;
  const nodes = [];
  function visit(node, x, y, depth, edge) {
    if (!node) return;
    const id = nodes.length;
    nodes.push({ node, x, y, depth, edge });
    if (node.left) visit(node.left, x - 115 / (depth + 1), y + 75, depth + 1, "0");
    if (node.right) visit(node.right, x + 115 / (depth + 1), y + 75, depth + 1, "1");
    nodes[id].left = nodes.find((item) => item.node === node.left);
    nodes[id].right = nodes.find((item) => item.node === node.right);
  }
  visit(tree, 300, 38, 0);
  return <svg className="tree-svg" viewBox="0 0 600 330" role="img" aria-label="Huffman tree">
    {nodes.map((item) => item.node.left && <line className="tree-edge" key={`l-${item.x}-${item.y}`} x1={item.x} y1={item.y + 16} x2={item.x - 115 / (item.depth + 1)} y2={item.y + 59} />)}
    {nodes.map((item) => item.node.right && <line className="tree-edge" key={`r-${item.x}-${item.y}`} x1={item.x} y1={item.y + 16} x2={item.x + 115 / (item.depth + 1)} y2={item.y + 59} />)}
    {nodes.map((item) => <g key={`${item.x}-${item.y}`} className={item.node.byte !== undefined ? "tree-leaf" : "tree-internal"}>
      <circle cx={item.x} cy={item.y} r="18" />
      <text x={item.x} y={item.y + 4} textAnchor="middle">{item.node.byte !== undefined ? byteLabel(item.node.byte) : item.node.frequency}</text>
      {item.edge && <text className="edge-label" x={item.x + (item.edge === "0" ? 22 : -22)} y={item.y - 21}>{item.edge}</text>}
    </g>)}
    {codes?.length > 0 && <text className="svg-note" x="16" y="315">0 = left · 1 = right</text>}
  </svg>;
}

function Stage({ step }) {
  const state = step?.state || {};
  if (["count", "scan"].includes(step?.phase)) return <><ByteStrip bytes={state.bytes} pointer={state.pointer} start={state.start} end={state.end} /><div className="visual-bars">{state.frequencies?.map((item) => <span style={{ height: `${Math.min(150, item.frequency * 24)}px` }} title={byteLabel(item.byte)} key={item.byte}><b>{item.frequency}</b><small>{byteLabel(item.byte)}</small></span>)}</div></>;
  if (step?.phase === "heap") return <div className="demo-stage"><h3>Min-heap array</h3><div className="heap-array">{state.heap?.map((item, index) => <span key={index}><small>{index}</small>{byteLabel(item.byte)} · {item.frequency}</span>)}</div><p className="stage-note">The smallest frequency stays at the root.</p></div>;
  if (["build", "codes", "decode"].includes(step?.phase) && (state.tree || state.merged || state.node)) return <div className="demo-stage"><TreeStage state={state} codes={state.codes} />{state.decoded && <ByteStrip bytes={state.decoded} />}</div>;
  if (step?.phase === "encode") return <div className="demo-stage"><ByteStrip bytes={state.bytes} pointer={state.pointer} /><div className="bitstream">{state.bitstream || " "}</div><p>{state.originalBits} original bits → {state.encodedBits} encoded bits</p></div>;
  if (step?.phase === "pairs") return <div className="pair-list">{state.pairs?.map((pair, index) => <span key={index}>({pair.count}, {byteLabel(pair.value)})</span>)}</div>;
  return <div className="demo-stage"><div className="lossless">Lossless ✓</div><ByteStrip bytes={state.decoded || state.bytes} /></div>;
}

export default function Visualizer({ file, initialAlgorithm = "huffman", onError }) {
  const [source, setSource] = useState(file ? "file" : "text");
  const [text, setText] = useState("ABRACADABRA");
  const [fileBytes, setFileBytes] = useState(null);
  const [algorithm, setAlgorithm] = useState(initialAlgorithm === "rle" ? "rle" : "huffman");
  const [presentation, setPresentation] = useState(false);
  useEffect(() => {
    let active = true;
    if (file) file.arrayBuffer().then((value) => { if (active) setFileBytes(new Uint8Array(value)); });
    return () => { active = false; };
  }, [file]);
  const input = useMemo(() => source === "file" && fileBytes ? fileBytes : new TextEncoder().encode(text), [fileBytes, source, text]);
  const distinct = new Set(input).size;
  const sample = useMemo(() => {
    return input;
  }, [input]);
  const steps = useMemo(() => makeDemoSteps(sample, algorithm), [algorithm, sample]);
  const player = useStepPlayer(steps);
  const phaseIndex = Math.max(0, phaseNames[algorithm].findIndex(([phase]) => phase === player.step?.phase));
  function choosePreset(value) { setSource("text"); setText(value); onError(""); }
  return <section className={presentation ? "visualizer presentation" : "visualizer"}>
    <div className="visualizer-head"><div><div className="eyebrow">Demo on a small sample</div><h2>Visualizer</h2></div><button className="secondary" onClick={() => setPresentation(!presentation)}>{presentation ? "Exit presentation" : "Presentation"}</button></div>
    <div className="visualizer-input">
      <span className="segmented"><button className={source === "file" ? "active" : ""} onClick={() => setSource("file")}>Uploaded file</button><button className={source === "text" ? "active" : ""} onClick={() => setSource("text")}>Type text</button></span>
      {source === "text" && <input value={text} onChange={(event) => setText(event.target.value)} aria-label="Visualizer sample text" />}
      <span className="preset-list">{presets.map((preset) => <button className="text-button" onClick={() => choosePreset(preset)} key={preset}>{preset}</button>)}</span>
      <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)} aria-label="Visualizer algorithm"><option value="huffman">Huffman</option><option value="rle">RLE</option></select>
      {distinct > 16 && <small className="muted">Using first {sample.length} bytes</small>}
    </div>
    <div className="phase-stepper">{phaseNames[algorithm].map(([phase, label], index) => <button className={index === phaseIndex ? "current" : ""} onClick={() => { const target = steps.findIndex((step) => step.phase === phase); if (target >= 0) player.seek(target); }} key={phase}><i />{label}</button>)}</div>
    <div className="visualizer-stage"><Stage step={player.step} /></div>
    <div className="visualizer-caption"><div><b>{player.step?.title}</b><span>{player.step?.explanation}</span></div><em>{player.step?.concept}</em></div>
    <div className="control-bar"><button className="secondary" onClick={player.back}>Back</button><button className="primary" onClick={player.toggle}>{player.playing ? "Pause" : "Play"}</button><button className="secondary" onClick={player.next}>Next</button><button className="secondary" onClick={player.restart}>Restart</button><input type="range" min="0" max={Math.max(0, steps.length - 1)} value={player.index} onChange={(event) => player.seek(Number(event.target.value))} aria-label="Visualizer progress" /><span>Step {player.index + 1} / {steps.length}</span><select value={player.speed} onChange={(event) => player.setSpeed(Number(event.target.value))} aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></div>
    <details className="visualizer-details"><summary>Details</summary><p>n = sample bytes · k = distinct symbols · Huffman: O(n + k log k) · RLE: O(n)</p></details>
  </section>;
}
