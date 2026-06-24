import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FCM_DEDUP_KEY = '@fcm_dedup_v1';
const DEDUP_TTL_MS  = 10_000; // 10 detik — cegah notif ganda dari WS + FCM

async function isDuplicate(key: string): Promise<boolean> {
  try {
    const raw  = await AsyncStorage.getItem(FCM_DEDUP_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now  = Date.now();
    for (const k of Object.keys(map)) {
      if (now - map[k] > DEDUP_TTL_MS) delete map[k];
    }
    if (map[key]) { await AsyncStorage.setItem(FCM_DEDUP_KEY, JSON.stringify(map)); return true; }
    map[key] = now;
    await AsyncStorage.setItem(FCM_DEDUP_KEY, JSON.stringify(map));
    return false;
  } catch { return false; }
}

async function tampilkanNotif(title: string, body: string) {
  try {
    await Notifications.setNotificationChannelAsync('presensi', {
      name:             'Presensi',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#1565C0',
    });
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {}
}

const BULAN_PENDEK = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export async function handleFcmMessage(data: Record<string, string>): Promise<void> {
  // ── Permit event ──────────────────────────────────────────────────────────
  // MangoSpot kirim field "permit" atau ada "id"+"status" tanpa "type" IN/OUT
  if ('permit' in data || ('id' in data && 'status' in data && data.type !== 'IN' && data.type !== 'OUT')) {
    const status  = String(data.status ?? '').toLowerCase();
    const msgKey  = `permit_${data.id}_${status}`;
    if (await isDuplicate(msgKey)) return;

    let title = '', body = '';
    if (status.startsWith('approve')) {
      title = 'Izin Disetujui';    body = 'Permohonan izin kamu telah disetujui.';
    } else if (status.startsWith('reject')) {
      title = 'Izin Ditolak';      body = 'Permohonan izin kamu ditolak.';
    } else if (status.startsWith('delet')) {
      title = 'Izin Dihapus';      body = 'Permohonan izin kamu telah dihapus oleh admin.';
    } else if (status.startsWith('wait') || status === 'pending') {
      title = 'Izin Dikembalikan'; body = 'Permohonan izin kamu dikembalikan untuk ditinjau ulang.';
    }

    if (title) await tampilkanNotif(title, body);
    return;
  }

  // ── Absent event ──────────────────────────────────────────────────────────
  if (data.type === 'IN' || data.type === 'OUT') {
    const status     = String(data.status ?? '').toLowerCase();
    const msgKey     = `absent_${data.id}_${status}`;
    if (await isDuplicate(msgKey)) return;

    const tipeAbsen  = data.type === 'OUT' ? 'Pulang' : 'Masuk';
    const dateRaw    = data.date ?? '';
    const dateObj    = new Date(dateRaw.replace(' ', 'T'));
    const tglFormatted = isNaN(dateObj.getTime())
      ? ''
      : `${dateObj.getDate()} ${BULAN_PENDEK[dateObj.getMonth()]} pukul ${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;

    let title = '', body = '';
    if (status === 'delete') {
      title = `Absensi ${tipeAbsen} Dihapus`;
      body  = `Absensi ${tipeAbsen.toLowerCase()} kamu${tglFormatted ? ` pada ${tglFormatted}` : ''} telah dihapus oleh admin.`;
    } else if (status === 'pending') {
      title = `Absensi ${tipeAbsen} Dinonaktifkan`;
      body  = `Absensi ${tipeAbsen.toLowerCase()} kamu${tglFormatted ? ` pada ${tglFormatted}` : ''} dinonaktifkan oleh admin.`;
    } else if (status === 'approve') {
      title = `Absensi ${tipeAbsen} Diaktifkan Kembali`;
      body  = `Absensi ${tipeAbsen.toLowerCase()} kamu${tglFormatted ? ` pada ${tglFormatted}` : ''} telah diaktifkan kembali oleh admin.`;
    }

    if (title) await tampilkanNotif(title, body);
    return;
  }

  // ── Fallback: pakai title/body langsung dari data jika ada ────────────────
  const title = data.title ?? data.judul ?? '';
  const body  = data.body  ?? data.pesan ?? '';
  if (title) await tampilkanNotif(title, body);
}
