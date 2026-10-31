import { useMemo, useState } from "react";
function Tree({ node, edge }) {
  if (!node) return null;
  return (
    <li>
      <span className="tree-node">
        {edge && <b>{edge} → </b>}
        {node.byte == null
          ? `internal · ${node.frequency}`
          : `${node.display} · ${node.frequency}`}
      </span>
      {node.left || node.right ? (
        <ul>
          <Tree node={node.left} edge="0" />
          <Tree node={node.right} edge="1" />
        </ul>
      ) : null}
    </li>
  );
}
export default function HuffmanInspector({ data }) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(true);
  const codes = useMemo(
    () =>
      data.codes.filter((item) =>
        `${item.byte} ${item.display} ${item.code}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [data, filter],
  );
  return (
    <section className="card inspector">
      <h2>Huffman inspector</h2>
      <div className="metrics compact">
        <span>
          Header<strong>{data.headerBytes} B</strong>
        </span>
        <span>
          Payload<strong>{data.payloadBytes} B</strong>
        </span>
        <span>
          Symbols<strong>{data.distinctSymbols}</strong>
        </span>
        <span>
          Avg. code<strong>{data.averageCodeLength.toFixed(2)} bits</strong>
        </span>
      </div>
      <p className="muted">
        Deterministic tie-breaking makes this output reproducible; other
        tie-breaking choices can change exact codes without changing
        correctness.
      </p>
      <input
        aria-label="Filter code table"
        placeholder="Filter symbols or codes"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Byte</th>
              <th>Display</th>
              <th>Frequency</th>
              <th>Code</th>
              <th>Length</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((item) => (
              <tr key={item.byte}>
                <td>{item.byte}</td>
                <td>{item.display}</td>
                <td>{item.frequency}</td>
                <td>
                  <code>{item.code}</code>
                </td>
                <td>{item.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="secondary" onClick={() => setOpen(!open)}>
        {open ? "Collapse" : "Expand"} tree
      </button>
      {open && (
        <ul className="tree">
          <Tree node={data.tree} />
        </ul>
      )}
    </section>
  );
}
