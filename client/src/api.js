const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => ({ ok: false, error: 'Invalid server response.' }));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function upload(path, file, fields = {}) {
  const body = new FormData();
  body.append('file', file);
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  return request(path, { method: 'POST', body });
}
export const getHealth = () => request('/api/health');
export const compress = (file, algorithm) => upload('/api/compress', file, { algorithm });
export const compare = (file) => upload('/api/compare', file);
export const decompress = (file) => upload('/api/decompress', file);
export const getHistory = () => request('/api/history');
export function trace(file, algorithm, sampleSize, text) {
  const body = new FormData();
  if (file) body.append('file', file);
  if (text != null) body.append('text', text);
  body.append('algorithm', algorithm);
  body.append('sampleSize', sampleSize);
  return request('/api/trace', { method: 'POST', body });
}
export function downloadBase64(base64, fileName, type = 'application/octet-stream') {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
}
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
