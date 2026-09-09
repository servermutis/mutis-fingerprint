import { supabase } from './supabaseClient';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * Ambil access token Supabase yang sedang aktif untuk dikirim sebagai
 * Authorization: Bearer <token> ke backend Node.js (dibaca oleh
 * backend/middleware/auth.js -> requireAuth).
 */
async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesi login tidak ditemukan, silakan login ulang.');
  return { Authorization: `Bearer ${token}` };
}

async function parseErrorBody(res) {
  try {
    const body = await res.json();
    return body?.error || `Permintaan gagal (${res.status})`;
  } catch {
    return `Permintaan gagal (${res.status})`;
  }
}

/** GET/POST/PATCH JSON biasa ke backend, dengan auth header otomatis. */
export async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  return res.json();
}

/**
 * Untuk endpoint export (Excel/CSV/PDF) yang me-return file, bukan JSON.
 * Memicu unduhan file di browser langsung.
 */
export async function apiDownload(path, filename) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(await parseErrorBody(res));
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
