import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';
import { AUTH_KEYS } from './apiClient';
import { WEBSITE_TOKEN, WEBSITE_DOMAIN, BASE_URL } from '../constants/api';
import { saveWsNotif, getReadIds, saveReadIds } from './NotificationService';

const WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// State WS di globalThis agar persisten selama Fast Refresh (hot reload) development.
// Tanpa ini, setiap file save membuat module baru dengan ws=null, sehingga terbuka
// koneksi baru sedangkan koneksi lama tetap hidup → belasan koneksi aktif sekaligus.
type WsConn = {
  ws:             WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  isConnecting:   boolean;
  generation:     number;
};

type WsState = {
  permit:       WsConn;
  absent:       WsConn;
  stopped:      boolean;
  recentMsgKeys: Set<string>;
};

const WS_STATE_VERSION = 2;

function initFreshState(): WsState {
  return {
    permit:        { ws: null, reconnectTimer: null, isConnecting: false, generation: 0 },
    absent:        { ws: null, reconnectTimer: null, isConnecting: false, generation: 0 },
    stopped:       false,
    recentMsgKeys: new Set<string>(),
  };
}

const g: WsState = (() => {
  const prev = (globalThis as any).__wsService as any;
  // Jika struktur lama (tidak punya .permit) atau versi berbeda, tutup koneksi lama & reset
  if (!prev || prev._v !== WS_STATE_VERSION) {
    try { prev?.ws?.close(); }        catch {}
    try { prev?.permit?.ws?.close(); } catch {}
    try { prev?.absent?.ws?.close(); } catch {}
    const fresh = { ...initFreshState(), _v: WS_STATE_VERSION };
    (globalThis as any).__wsService = fresh;
    return fresh;
  }
  return prev as WsState;
})();

async function showNotif(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.warn('[WS] showNotif gagal:', e);
  }
}

// ─── Handler pesan ws/permit ──────────────────────────────────────────────────

async function handlePermitMessage(raw: string) {
  console.log('[WS/permit] event:', raw);
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>;

    if (msg.type === 'Auth') return;

    if ('permit' in msg && 'id' in msg) {
      const status  = msg.status as string;
      const msgKey  = `permit_${msg.id}_${status}`;
      if (g.recentMsgKeys.has(msgKey)) { console.log('[WS/permit] dup skipped:', msgKey); return; }
      g.recentMsgKeys.add(msgKey);
      setTimeout(() => g.recentMsgKeys.delete(msgKey), 3000);

      console.log('[WS/permit] Permit update id:', msg.id, 'status:', status);
      DeviceEventEmitter.emit('ws:permit', msg);

      const statusLower = status.toLowerCase();
      let judul = ''; let pesan = '';
      if (statusLower.startsWith('approve')) {
        judul = 'Izin Disetujui';    pesan = 'Permohonan izin kamu telah disetujui.';
      } else if (statusLower.startsWith('reject')) {
        judul = 'Izin Ditolak';      pesan = 'Permohonan izin kamu ditolak.';
      } else if (statusLower.startsWith('delet')) {
        judul = 'Izin Dihapus';      pesan = 'Permohonan izin kamu telah dihapus oleh admin.';
      } else if (statusLower.startsWith('wait') || statusLower === 'pending') {
        judul = 'Izin Dikembalikan'; pesan = 'Permohonan izin kamu dikembalikan untuk ditinjau ulang.';
      }

      if (judul) {
        await showNotif(judul, pesan);
        const now     = new Date();
        const waktu   = `Hari ini, ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const action  = statusLower.startsWith('approve') ? 'Approve'
                      : statusLower.startsWith('reject')  ? 'Reject'
                      : statusLower.startsWith('delet')   ? 'Delete'
                      : 'Waiting';
        const notifId = `permit_${msg.id}_${action}`;

        await saveWsNotif({ id: notifId, judul, pesan, waktu, tipe: 'izin', timestamp: Date.now() });

        // Pastikan notif baru muncul sebagai belum dibaca meski ID pernah ditandai dibaca
        const readIds = await getReadIds();
        if (readIds.has(notifId)) { readIds.delete(notifId); await saveReadIds(readIds); }
      }
      return;
    }

    console.log('[WS/permit] unhandled message:', msg);
  } catch {
    console.log('[WS/permit] non-JSON message:', raw);
  }
}

// ─── Handler pesan ws/absent ──────────────────────────────────────────────────
// Format: { id, name, type: "IN"|"OUT", date: "YYYY-MM-DD HH:mm:ss", info, status: "Delete"|... }

const BULAN_PENDEK = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

async function handleAbsentMessage(raw: string) {
  console.log('[WS/absent] event:', raw);
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>;

    if (msg.type === 'Auth') return;

    const statusLower = String(msg.status ?? '').toLowerCase();
    const msgKey      = `absent_${msg.id}_${statusLower}`;
    if (g.recentMsgKeys.has(msgKey)) { console.log('[WS/absent] dup skipped:', msgKey); return; }
    g.recentMsgKeys.add(msgKey);
    setTimeout(() => g.recentMsgKeys.delete(msgKey), 3000);

    DeviceEventEmitter.emit('ws:absent', msg);

    // type: "IN" = absen masuk, "OUT" = absen pulang
    const tipeAbsen   = (msg.type as string) === 'OUT' ? 'Pulang' : 'Masuk';
    const dateRaw     = msg.date as string; // "2026-06-22 10:52:14"
    const dateObj     = new Date(dateRaw.replace(' ', 'T'));
    const tglFormatted = `${dateObj.getDate()} ${BULAN_PENDEK[dateObj.getMonth()]} pukul ${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;

    let judul = ''; let pesan = '';

    if (statusLower === 'delete') {
      judul = `Absensi ${tipeAbsen} Dihapus`;
      pesan = `Absensi ${tipeAbsen.toLowerCase()} kamu pada ${tglFormatted} telah dihapus oleh admin.`;
    } else if (statusLower === 'pending') {
      judul = `Absensi ${tipeAbsen} Dinonaktifkan`;
      pesan = `Absensi ${tipeAbsen.toLowerCase()} kamu pada ${tglFormatted} dinonaktifkan oleh admin.`;
    } else if (statusLower === 'approve') {
      judul = `Absensi ${tipeAbsen} Diaktifkan Kembali`;
      pesan = `Absensi ${tipeAbsen.toLowerCase()} kamu pada ${tglFormatted} telah diaktifkan kembali oleh admin.`;
    }

    if (judul) {
      await showNotif(judul, pesan);
      const now     = new Date();
      const waktu   = `Hari ini, ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const notifId = `absent_${msg.id}_${statusLower}`;

      await saveWsNotif({ id: notifId, judul, pesan, waktu, tipe: 'absensi', timestamp: Date.now() });

      const readIds = await getReadIds();
      if (readIds.has(notifId)) { readIds.delete(notifId); await saveReadIds(readIds); }
    }

  } catch {
    console.log('[WS/absent] non-JSON message:', raw);
  }
}

// Setiap kali module dievaluasi ulang (hot reload), rewire handler ke fungsi terbaru.
// Tanpa ini, WS yang masih hidup tetap pakai handler lama dari evaluasi sebelumnya.
if (g.permit.ws) g.permit.ws.onmessage = (e) => handlePermitMessage(e.data);
if (g.absent.ws) g.absent.ws.onmessage = (e) => handleAbsentMessage(e.data);

// ─── Koneksi ws/permit ────────────────────────────────────────────────────────

async function connectPermit() {
  if (g.stopped) return;
  const c = g.permit;
  if (c.ws || c.isConnecting) return;
  c.isConnecting = true;
  const myGen = ++c.generation;

  const socket = await SecureStore.getItemAsync(AUTH_KEYS.SOCKET);
  if (myGen !== c.generation || g.stopped) { c.isConnecting = false; return; }
  if (!socket) { c.isConnecting = false; console.log('[WS/permit] Auth-Socket kosong'); return; }

  console.log('[WS/permit] connecting...');
  // @ts-ignore
  c.ws = new WebSocket(`${WS_URL}/ws/permit`, undefined, {
    headers: { 'Website-Token': WEBSITE_TOKEN, 'Website-Domain': WEBSITE_DOMAIN, 'Auth-Socket': socket },
  });

  const connectedAt = Date.now();
  c.ws.onopen    = () => { c.isConnecting = false; console.log('[WS/permit] connected at', new Date().toISOString()); };
  c.ws.onmessage = (e) => handlePermitMessage(e.data);
  c.ws.onerror   = (e) => { c.isConnecting = false; console.log('[WS/permit] error', (e as any).message); };
  c.ws.onclose   = (e) => {
    const lived = ((Date.now() - connectedAt) / 1000).toFixed(1);
    console.log('[WS/permit] closed code:', e.code, `lived ${lived}s`);
    c.ws = null; c.isConnecting = false;
    if (!g.stopped) c.reconnectTimer = setTimeout(connectPermit, 5000);
  };
}

// ─── Koneksi ws/absent ────────────────────────────────────────────────────────

async function connectAbsent() {
  if (g.stopped) return;
  const c = g.absent;
  if (c.ws || c.isConnecting) return;
  c.isConnecting = true;
  const myGen = ++c.generation;

  const socket = await SecureStore.getItemAsync(AUTH_KEYS.SOCKET);
  if (myGen !== c.generation || g.stopped) { c.isConnecting = false; return; }
  if (!socket) { c.isConnecting = false; console.log('[WS/absent] Auth-Socket kosong'); return; }

  console.log('[WS/absent] connecting...');
  // @ts-ignore
  c.ws = new WebSocket(`${WS_URL}/ws/absent`, undefined, {
    headers: { 'Website-Token': WEBSITE_TOKEN, 'Website-Domain': WEBSITE_DOMAIN, 'Auth-Socket': socket },
  });

  const connectedAt = Date.now();
  c.ws.onopen    = () => { c.isConnecting = false; console.log('[WS/absent] connected at', new Date().toISOString()); };
  c.ws.onmessage = (e) => handleAbsentMessage(e.data);
  c.ws.onerror   = (e) => { c.isConnecting = false; console.log('[WS/absent] error', (e as any).message); };
  c.ws.onclose   = (e) => {
    const lived = ((Date.now() - connectedAt) / 1000).toFixed(1);
    console.log('[WS/absent] closed code:', e.code, `lived ${lived}s`);
    c.ws = null; c.isConnecting = false;
    if (!g.stopped) c.reconnectTimer = setTimeout(connectAbsent, 5000);
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startWS() {
  g.stopped = false;

  // Jika WS sudah ada (hot reload), perbarui handler saja
  if (g.permit.ws) g.permit.ws.onmessage = (e) => handlePermitMessage(e.data);
  else {
    if (g.permit.reconnectTimer) clearTimeout(g.permit.reconnectTimer);
    connectPermit();
  }

  if (g.absent.ws) g.absent.ws.onmessage = (e) => handleAbsentMessage(e.data);
  else {
    if (g.absent.reconnectTimer) clearTimeout(g.absent.reconnectTimer);
    connectAbsent();
  }
}

export function stopWS() {
  g.stopped = true;

  g.permit.generation++; g.permit.isConnecting = false;
  if (g.permit.reconnectTimer) clearTimeout(g.permit.reconnectTimer);
  g.permit.ws?.close(); g.permit.ws = null;

  g.absent.generation++; g.absent.isConnecting = false;
  if (g.absent.reconnectTimer) clearTimeout(g.absent.reconnectTimer);
  g.absent.ws?.close(); g.absent.ws = null;
}
