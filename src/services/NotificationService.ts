import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isExpoGo = Constants.appOwnership === 'expo';
import { getAbsentCheck, getAbsentReport } from './absentService';
import { getPermitHistory } from './permitService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

export async function mintaIzinNotifikasi(): Promise<boolean> {
  if (!Device.isDevice || isExpoGo) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('presensi', {
      name: 'Presensi',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1565C0',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Jadwalkan reminder harian 06:30 — hanya tampil jika belum absen
export async function jadwalkanReminderHarian() {
  if (isExpoGo) return;

  const jadwal = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of jadwal) {
    if ((n.content.data as Record<string, unknown>)?.tipe === 'reminder_absen') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Belum Absen Hari Ini',
      body:  'Jangan lupa melakukan presensi masuk sebelum jam 07:30.',
      data:  { tipe: 'reminder_absen' },
    },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.DAILY,
      hour:    6,
      minute:  30,
    },
  });
}

// ─── In-app notification builder ─────────────────────────────────────────────

export type NotifTipe = 'absensi' | 'izin' | 'sistem';

export interface NotifItem {
  id:        string;
  judul:     string;
  pesan:     string;
  waktu:     string;
  tipe:      NotifTipe;
  dibaca:    boolean;
  timestamp: number;
}

const STORAGE_KEY          = '@notif_read_v1';
const SETTINGS_KEY         = '@notif_settings_v1';

export interface NotifSettings {
  reminderHarian:  boolean; // push reminder 06:30
  statusIzin:      boolean; // Approved / Rejected
  peringatanTelat: boolean; // absen terlambat
  peringatanNoOut: boolean; // lupa checkout
}

const DEFAULT_SETTINGS: NotifSettings = {
  reminderHarian:  true,
  statusIzin:      true,
  peringatanTelat: true,
  peringatanNoOut: true,
};

export async function getNotifSettings(): Promise<NotifSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

export async function saveNotifSettings(settings: NotifSettings): Promise<void> {
  try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysDiff(dateStr: string, todayStr: string): number {
  const a = new Date(dateStr  + 'T00:00:00').getTime();
  const b = new Date(todayStr + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function formatRelative(dateStr: string, todayStr: string): string {
  const diff = daysDiff(dateStr, todayStr);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  if (diff < 7)   return `${diff} hari lalu`;
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
}

function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export async function getReadIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

export async function saveReadIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export async function cancelReminderHarian(): Promise<void> {
  if (isExpoGo) return;
  const jadwal = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of jadwal) {
    if ((n.content.data as Record<string, unknown>)?.tipe === 'reminder_absen') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function buildNotifications(): Promise<NotifItem[]> {
  const settings = await getNotifSettings();
  const today    = new Date();
  const todayStr = toDateStr(today);
  const cutoff   = toDateStr(new Date(today.getTime() - 14 * 86400000)); // 14 hari lalu

  const [checkRes, reportRes, permitRes] = await Promise.allSettled([
    getAbsentCheck(),
    getAbsentReport('', ''),
    getPermitHistory(0, 100),
  ]);

  const raw: Omit<NotifItem, 'dibaca'>[] = [];

  // ── 1. Izin: status Approved / Rejected ──────────────────────────────────
  if (settings.statusIzin && permitRes.status === 'fulfilled') {
    const permits = permitRes.value.data.data ?? [];
    for (const p of permits) {
      if (p.action !== 'Approved' && p.action !== 'Rejected') continue;
      const tgl = p.starts.split(' ')[0];
      raw.push({
        id:        `permit_${p.id}_${p.action}`,
        judul:     p.action === 'Approved' ? 'Izin Disetujui ✓' : 'Izin Ditolak',
        pesan:     `Pengajuan izin ${p.permittance} tanggal ${formatTanggal(tgl)} telah ${p.action === 'Approved' ? 'disetujui' : 'ditolak'}.`,
        waktu:     formatRelative(tgl, todayStr),
        tipe:      'izin',
        timestamp: new Date(p.starts.replace(' ', 'T')).getTime(),
      });
    }
  }

  // ── 2. Absensi: terlambat & lupa checkout (14 hari terakhir, bukan hari ini) ──
  if ((settings.peringatanTelat || settings.peringatanNoOut) && reportRes.status === 'fulfilled') {
    const records = (reportRes.value.data.data ?? [])
      .filter(r => r.date >= cutoff && r.date < todayStr);

    for (const r of records) {
      const [masuk, keluar] = r.status.split('/');

      if (settings.peringatanTelat && masuk === 'TM' && r.start) {
        raw.push({
          id:        `terlambat_${r.date}`,
          judul:     'Absensi Masuk Terlambat',
          pesan:     `Anda tercatat terlambat masuk pada ${formatTanggal(r.date)} pukul ${r.start}.`,
          waktu:     formatRelative(r.date, todayStr),
          tipe:      'absensi',
          timestamp: new Date(`${r.date}T${r.start}`).getTime(),
        });
      }

      if (settings.peringatanNoOut && keluar === 'NO' && r.start) {
        raw.push({
          id:        `no_checkout_${r.date}`,
          judul:     'Lupa Absensi Pulang',
          pesan:     `Tidak ada catatan absensi pulang pada ${formatTanggal(r.date)}. Segera hubungi admin jika diperlukan.`,
          waktu:     formatRelative(r.date, todayStr),
          tipe:      'absensi',
          timestamp: new Date(`${r.date}T23:59:00`).getTime(),
        });
      }
    }
  }

  // ── 3. Belum absen masuk / lupa checkout hari ini ────────────────────────
  if (checkRes.status === 'fulfilled') {
    const { presence } = checkRes.value.data.data;
    const serverTime = checkRes.value.data.data.time; // "HH:MM:SS"
    const isWorkday  = today.getDay() !== 0 && !presence.locked; // bukan Minggu & bukan libur

    // Cek catatan absen hari ini dari /absent/report — start/finish per tanggal,
    // tidak terpengaruh status absen hari sebelumnya (anti "nyangkut").
    const todayReport = reportRes.status === 'fulfilled'
      ? (reportRes.value.data.data ?? []).find(r => r.date === todayStr)
      : undefined;

    // Belum check-in: setelah batas tepat waktu dan masih dalam window
    if (isWorkday && !todayReport?.start && serverTime >= presence.onstart && serverTime <= presence.endstart) {
      raw.push({
        id:        `belum_masuk_${todayStr}`,
        judul:     'Belum Absensi Masuk',
        pesan:     `Hari ini Anda belum tercatat masuk. Batas toleransi pukul ${presence.ofstart.substring(0, 5)}.`,
        waktu:     'Hari ini',
        tipe:      'absensi',
        timestamp: Date.now(),
      });
    }

    // Sudah masuk tapi belum checkout: setelah jam pulang dan window keluar masih buka
    if (settings.peringatanNoOut && isWorkday && todayReport?.start && !todayReport?.finish
        && serverTime >= presence.offinish && serverTime <= presence.endfinish) {
      raw.push({
        id:        `belum_keluar_${todayStr}`,
        judul:     'Belum Absensi Pulang',
        pesan:     `Anda belum melakukan absensi pulang hari ini. Jangan lupa sebelum pukul ${presence.endfinish.substring(0, 5)}.`,
        waktu:     'Hari ini',
        tipe:      'absensi',
        timestamp: Date.now() - 1,
      });
    }
  }

  // ── Gabungkan dengan status baca dari AsyncStorage ────────────────────────
  const readIds = await getReadIds();
  const notifs: NotifItem[] = raw
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(n => ({ ...n, dibaca: readIds.has(n.id) }));

  return notifs;
}
