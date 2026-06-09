const Colors = {
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

export default Colors;
