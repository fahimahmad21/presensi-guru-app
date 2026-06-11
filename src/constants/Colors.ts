const light = {
  // ── Brand ─────────────────────────────────────────────────────────────────
  primary:      '#1565C0',
  primaryDark:  '#0D47A1',
  primaryLight: '#BBDEFB',
  primaryXLight:'#EBF3FD',

  accent:     '#FFC107',
  accentDark: '#FF8F00',
  accentLight:'#FFF8E1',

  // ── Neutral ────────────────────────────────────────────────────────────────
  white:      '#FFFFFF',
  background: '#F5F5F5',

  textPrimary:   '#212121',
  textSecondary: '#616161',
  textTertiary:  '#9E9E9E',
  textHint:      '#BDBDBD',

  border:  '#E0E0E0',
  divider: '#F5F5F5',

  infoLight: '#E3F2FD',

  // ── Status KEHADIRAN (dipakai di semua screen secara konsisten) ─────────────
  // Hadir      → hijau
  statusHadir:   '#1B5E20',
  statusHadirBg: '#E8F5E9',
  // Terlambat  → oranye
  statusTerlambat:   '#BF360C',
  statusTerlambatBg: '#FBE9E7',
  // Alpha      → merah
  statusAlpha:   '#B71C1C',
  statusAlphaBg: '#FFEBEE',
  // Izin       → kuning-amber
  statusIzin:    '#E65100',
  statusIzinBg:  '#FFF3E0',

  // ── Status PENGAJUAN (Izin, Payroll) ──────────────────────────────────────
  // Disetujui  → hijau (sama dengan Hadir)
  statusOk:    '#1B5E20',
  statusOkBg:  '#E8F5E9',
  // Menunggu   → amber
  statusWait:   '#E65100',
  statusWaitBg: '#FFF3E0',
  // Ditolak    → merah
  statusReject:   '#B71C1C',
  statusRejectBg: '#FFEBEE',

  // ── Semantic aliases (backward-compat) ────────────────────────────────────
  success:      '#1B5E20',
  successLight: '#E8F5E9',
  warning:      '#BF360C',
  warningLight: '#FBE9E7',
  error:        '#B71C1C',
  errorLight:   '#FFEBEE',
};

const dark: typeof light = {
  // ── Brand ─────────────────────────────────────────────────────────────────
  primary:      '#1E88E5',
  primaryDark:  '#0D47A1',
  primaryLight: '#27445E',
  primaryXLight:'#16263A',

  accent:     '#FFC107',
  accentDark: '#FFB300',
  accentLight:'#3A2F12',

  // ── Neutral ────────────────────────────────────────────────────────────────
  white:      '#1E1E1E',
  background: '#121212',

  textPrimary:   '#ECECEC',
  textSecondary: '#B0B0B0',
  textTertiary:  '#8A8A8A',
  textHint:      '#6E6E6E',

  border:  '#333333',
  divider: '#2A2A2A',

  infoLight: '#16263A',

  // ── Status KEHADIRAN ────────────────────────────────────────────────────────
  statusHadir:   '#66BB6A',
  statusHadirBg: '#1B3320',
  statusTerlambat:   '#FF8A65',
  statusTerlambatBg: '#3A2014',
  statusAlpha:   '#EF5350',
  statusAlphaBg: '#3A1417',
  statusIzin:    '#FFB74D',
  statusIzinBg:  '#3A2A12',

  // ── Status PENGAJUAN (Izin, Payroll) ──────────────────────────────────────
  statusOk:    '#66BB6A',
  statusOkBg:  '#1B3320',
  statusWait:   '#FFB74D',
  statusWaitBg: '#3A2A12',
  statusReject:   '#EF5350',
  statusRejectBg: '#3A1417',

  // ── Semantic aliases (backward-compat) ────────────────────────────────────
  success:      '#66BB6A',
  successLight: '#1B3320',
  warning:      '#FF8A65',
  warningLight: '#3A2014',
  error:        '#EF5350',
  errorLight:   '#3A1417',
};

export type ColorPalette = typeof light;

export const Palettes = { light, dark };

export default light;
