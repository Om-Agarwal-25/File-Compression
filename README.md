# ByteWise — File Compression & Algorithm Analyzer

ByteWise is a MERN-style educational application for comparing two hand-written,
lossless, byte-oriented algorithms: Huffman coding and Run-Length Encoding (RLE).
It accepts text, images, PDFs, empty files, and arbitrary binary data. Every
compression request is decoded immediately on the server and checked with both
`Buffer.equals` and SHA-256.

## Features

- Huffman coding with a deterministic array min-heap, frequency-table header,
  MSB-first bit packing, tree inspection, and code table.
- RLE with 255-byte run splitting and a compact custom format.
- Compare mode with size and encode-speed winners.
- Optional MongoDB metrics history (no file contents or Base64 is stored).
- React/Vite dashboard, responsive CSS/SVG-style bars, decompression downloads,
  status polling, and complexity learning page.

## Architecture

```text
 Browser (React + Vite)
       │ JSON / multipart file upload
       ▼
 Express API ── algorithms ── Huffman / RLE
       │
       └──────── optional Mongoose ── MongoDB (metrics only)
```

## Folder structure

```text
daa-mern-compressor/
├── client/                 # React 18 + Vite
└── server/
    ├── src/algorithms/     # custom byte algorithms and verification
    ├── src/models/         # optional history model
    └── tests/              # Node built-in test runner
```

## Prerequisites

- Current Node.js LTS and npm
- MongoDB is optional; the application works with an empty `MONGODB_URI`

## Windows PowerShell setup

From the project directory:

```powershell
Set-Location .\server
npm install
Copy-Item .env.example .env
npm run dev
```

In a second PowerShell terminal:

```powershell
Set-Location .\client
npm install
Copy-Item .env.example .env
npm run dev
```

Open <http://localhost:5173>. Check the API at
<http://localhost:5000/api/health>.

## Environment variables

| Variable        |                 Default | Description                        |
| --------------- | ----------------------: | ---------------------------------- |
| `PORT`          |                  `5000` | Express listening port             |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origin             |
| `MONGODB_URI`   |                   empty | Optional MongoDB connection string |
| `MAX_FILE_MB`   |                    `10` | In-memory upload limit             |
| `VITE_API_URL`  | `http://localhost:5000` | Client API base URL                |

## API reference

All errors use `{ "ok": false, "error": "..." }`.

| Method | Endpoint          | Purpose                                    |
| ------ | ----------------- | ------------------------------------------ | ---- |
| GET    | `/api/health`     | API, database, and size-limit status       |
| POST   | `/api/compress`   | Multipart `file` plus `algorithm=huffman   | rle` |
| POST   | `/api/compare`    | Multipart `file`, runs both algorithms     |
| POST   | `/api/decompress` | Multipart `file`, detects `HUF1` or `RLE1` |
| GET    | `/api/history`    | Up to 50 newest metrics records            |
| POST   | `/api/trace`      | Trace a small file/text sample for the Visualizer |

Example PowerShell request:

```powershell
curl.exe -F "file=@.\photo.png" -F "algorithm=huffman" http://localhost:5000/api/compress
```

Example response shape:

```json
{
  "ok": true,
  "fileName": "notes.txt",
  "algorithm": "huffman",
  "originalSize": 1234,
  "compressedSize": 987,
  "ratio": 1.25,
  "spaceSavedPercent": 20,
  "verified": true,
  "outputFileName": "notes.txt.huf",
  "compressedBase64": "..."
}
```

### Visualizer

The **Visualizer** tab replays a bounded sample through the same Huffman or RLE
implementation used for compression. It exposes frequency counting, heap
insertion, greedy tree merges, code assignment, bit packing, decoding, and
lossless verification as self-contained snapshots. Use the sample-size slider
for an uploaded file, enter custom text, or choose a classroom-friendly preset.
Samples are capped at 24 distinct byte values so the tree remains readable;
non-printable bytes are still preserved and represented by their byte values.

`POST /api/trace` accepts multipart fields `file` (optional), `text` (optional),
`algorithm` (`huffman` or `rle`), and `sampleSize` (8–256). The response
contains `sample`, `encode.steps`, `decode.steps`, and `summary`. No source
contents are stored in MongoDB. Keyboard users can operate the playback buttons
and scrubber; the theme toggle is persisted in `localStorage`.

For a five-minute presentation: check the API status, upload a small text file,
run **Compare**, open the **Visualizer**, select `ABRACADABRA`, then step through
the heap and greedy merge phases. Finish by showing the verification snapshot
and the header overhead in the summary.

## File formats

### `.huf`

| Offset |     Size | Meaning                                  |
| -----: | -------: | ---------------------------------------- |
|      0 |        4 | ASCII `HUF1`                             |
|      4 |        4 | Original byte count, unsigned big-endian |
|      8 |     1024 | 256 unsigned big-endian frequencies      |
|   1032 | variable | MSB-first packed Huffman bits            |

### `.rle`

The file begins with ASCII `RLE1`, followed by repeated two-byte pairs:
`count` (1–255), then `value`. Empty input is only the four-byte magic.

## Complexity

| Operation           | Time       | Space           |
| ------------------- | ---------- | --------------- |
| Frequency counting  | O(n)       | O(k)            |
| Build Huffman tree  | O(k log k) | O(k)            |
| Generate codes      | O(k)       | O(k)            |
| Huffman encode      | O(n + B)   | O(B)            |
| Huffman decode      | O(c + n)   | O(n + k)        |
| RLE encode          | O(n)       | O(n) worst case |
| RLE decode          | O(m + n)   | O(n)            |
| Hash + exact verify | O(n)       | O(n)            |

Outputs can be larger than inputs: Huffman always has a 1,032-byte header and
RLE can represent a one-byte run using two bytes. A single run is not a
rigorous benchmark.

## Tests and builds

```powershell
Set-Location .\server
npm test

Set-Location ..\client
npm run build
```

The server tests cover empty, single-symbol, text, all-byte, random binary,
corrupt/truncated data, size limits, API round trips, and verification.

## Limitations and security notes

- Uploads are held in memory and limited to 10 MB by default.
- Base64 responses add transport overhead.
- These custom formats are not compatible with zip/gzip tools.
- Public deployments should add authentication, rate limiting, HTTPS, and
  stricter operational resource limits.
- Never commit `.env` files or database credentials.

## Troubleshooting and future work

| Symptom              | Action                                                           |
| -------------------- | ---------------------------------------------------------------- |
| Browser says Offline | Start the server and check `/api/health`; verify `VITE_API_URL`. |
| Upload rejected      | Check `MAX_FILE_MB` and the selected server `.env`.              |
| History disabled     | Set `MONGODB_URI`; compression still works without it.           |
| Port in use          | Change `PORT` or stop the existing process.                      |

Possible future work includes LZW, streaming large files, richer benchmarking
charts, and PDF/CSV export.
