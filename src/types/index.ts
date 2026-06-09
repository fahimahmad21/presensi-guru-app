// ─── Navigation ───────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Absensi: undefined;
  Izin:    undefined;
  Laporan: undefined;
  Payroll: undefined;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface UserProfile {
  country:  number;
  code:     string;
  name:     string;
  email:    string;
  phone:    number;
  gender:   string;
  address:  string;
  place:    string | null;
  birthday: string | null;
  images:   string; // Base64
}

export interface CountryItem {
  id:    number;
  name:  string;
  phone: string; // dial digits e.g. "62" for Indonesia
}

// ─── Absent ───────────────────────────────────────────────────────────────────
export interface AbsentInfo {
  id:       number;
  level:    number;
  absent:   number;
  shift:    string;
  code:     string;
  name:     string;
  position: string;
  maps: {
    lat:    string;
    lng:    string;
    radius: string;
  };
  image: {
    icon: string; // Base64
    logo: string; // Base64
  };
  data: {
    name:   string;
    input:  string; // "07:10:00"
    output: string; // "15:00:00"
  };
}

export interface AbsentCheck {
  days:     string;
  date:     string;
  time:     string;
  datetime: string;
  absent: {
    code:  string; // "CM", "T", dll
    data:  string;
    name:  string;
    type:  'IN' | 'OUT';
    value: string;
  };
  presence: {
    name:      string;
    days:      string;
    onstart:   string;
    ofstart:   string;
    endstart:  string;
    onfinish:  string;
    offinish:  string;
    endfinish: string;
    locked:    boolean;
  };
}

export interface AbsentHistoryItem {
  id:     string;
  device: string;
  type:   'IN' | 'OUT';
  lat:    string;
  lng:    string;
  date:   string; // ISO datetime
  score:  string;
  info:   string | null;
  valid:  boolean;
  image:  string | null; // Base64
}

export interface AbsentReportItem {
  date:   string; // "YYYY-MM-DD"
  score:  number;
  start:  string; // "HH:MM"
  finish: string; // "HH:MM"
  status: string; // "CM/PT", "T/PC", dll
}

// Score code mapping
export const SCORE_LABEL: Record<string, string> = {
  CM: 'Cepat Masuk',
  T:  'Terlambat',
  PT: 'Pulang Tepat',
  PC: 'Pulang Cepat',
  P:  'Pulang Normal',
};

// ─── Permit ───────────────────────────────────────────────────────────────────
export interface PermitType {
  id:         string;
  code:       string;
  name:       string;
  mode:       'hour' | 'day' | 'other';
  attachment: boolean;
}

export interface PermitHistoryItem {
  id:          string;
  code:        string;
  position:    string;
  permittance: string;
  starts:      string; // "YYYY-MM-DD HH:MM"
  finish:      string;
  action:      'Waiting' | 'Approved' | 'Rejected';
  duration:    string;
  info:        string;
  attachment:  boolean;
  status:      boolean;
}

export interface PermitDetail {
  id:          string;
  permit:      string;
  code:        string;
  mode:        'hour' | 'day' | 'other';
  permittance: string;
  starts:      string;
  finish:      string;
  action:      'Waiting' | 'Approved' | 'Rejected';
  duration:    string;
  info:        string;
  file: {
    type: string;
    data: string;
  };
  attachment: boolean;
}

export interface PermitReportItem {
  date:   string;
  permit: string;
  start:  string;
  finish: string;
}

// ─── DataTable Response ───────────────────────────────────────────────────────
export interface DataTableResponse<T> {
  draw:            number;
  recordsTotal:    number;
  recordsFiltered: number;
  data:            T[];
}

// ─── Legacy types (masih dipakai di IzinScreen & AbsensiScreen — akan diganti saat migrasi Phase 3-4) ──
export type AbsensiStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Alpha';
export type DeviceType    = 'GPS' | 'Fingerprint' | 'Manual';

export interface AbsensiRecord {
  id: string; tanggal: string; bulan: string;
  jamMasuk?: string; jamKeluar?: string;
  nama: string; level: string;
  status: AbsensiStatus; device: DeviceType;
}

export type IzinJenis  = 'Jam' | 'Hari' | 'Pagi' | 'Sore' | 'Sakit' | 'Koordinator';
export type IzinStatus = 'Pending' | 'Approved' | 'Rejected';

export interface IzinRequest {
  id: string; jenis: IzinJenis; tanggal: string;
  waktu?: string; keterangan: string;
  status: IzinStatus; lampiran?: string; createdAt: string;
}

// ─── Payroll (tetap untuk screen Payroll) ────────────────────────────────────
export interface PayrollItem {
  id:          string;
  bulan:       string;
  tahun:       number;
  gajiPokok:   number;
  tFungsional: number;
  tTransport:  number;
  uangMakan:   number;
  potAbsen:    number;
  potBpjs:     number;
  totalBersih: number;
  hariHadir:   number;
  hariKerja:   number;
  status:      'Dibayar' | 'Pending';
  tanggalBayar?: string;
}
