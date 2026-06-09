import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Colors from '../../constants/Colors';
import { FontSize, Radius, Shadow } from '../../constants/Theme';
import AppHeader from '../../components/AppHeader';
import HeaderActions from '../../components/HeaderActions';
import { AbsentReportItem, AbsentHistoryItem, PermitReportItem } from '../../types';
import { getAbsentReport, getAllAbsentHistory } from '../../services/absentService';
import { getPermitReport } from '../../services/permitService';

type IonName = keyof typeof Ionicons.glyphMap;
type Periode = 'Harian' | 'Bulanan' | 'Tahunan' | 'Kustom';
type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Alpha' | 'Izin';

const BAR_MAX_H = 80;
const BULAN_SINGKAT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const BULAN_PANJANG  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const STATUS_CFG: Record<string, { icon: IonName; color: string; bg: string }> = {
  Hadir:     { icon: 'checkmark-circle', color: Colors.statusHadir,     bg: Colors.statusHadirBg     },
  Terlambat: { icon: 'time',             color: Colors.statusTerlambat, bg: Colors.statusTerlambatBg },
  Alpha:     { icon: 'close-circle',     color: Colors.statusAlpha,     bg: Colors.statusAlphaBg     },
  Izin:      { icon: 'document-text',    color: Colors.statusIzin,      bg: Colors.statusIzinBg      },
};

const BAR_COLOR: Record<string, string> = {
  Hadir: Colors.primary, Terlambat: Colors.accentDark,
  Alpha: Colors.border,  Izin: Colors.statusIzin,
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// API mungkin kirim "2026-06-09T07:05:00" atau "2026-06-09 07:05:00" — ambil bagian tanggalnya saja
function normalizeDate(s: string): string {
  return s.split('T')[0].split(' ')[0];
}

function fmtDisplayDate(d: Date) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return mon;
}

function getWeekRange(dateStr: string): [string, string] {
  const mon = getMonday(dateStr);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [toDateStr(mon), toDateStr(sun)];
}

function getMonthRange(year: number, monthIdx: number): [string, string] {
  return [toDateStr(new Date(year, monthIdx, 1)), toDateStr(new Date(year, monthIdx + 1, 0))];
}

function getYearRange(year: number): [string, string] {
  return [`${year}-01-01`, `${year}-12-31`];
}

// Working days in an arbitrary range (Mon-Sat only)
function countRangeWorkdays(startStr: string, endStr: string): number {
  const start = new Date(startStr + 'T00:00:00');
  const end   = new Date(endStr   + 'T00:00:00');
  let n = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

// ── History reconstruction ────────────────────────────────────────────────────
// /absent/report ignores date params and only returns the current month.
// For historical periods we use /absent/history (raw IN/OUT scans) and reconstruct
// daily summaries. Terlambat distinction is not available from raw scan data.

function buildAbsentFromHistory(
  items: AbsentHistoryItem[],
  startDate: string,
  endDate: string,
): AbsentReportItem[] {
  const byDate = new Map<string, { ins: string[]; outs: string[] }>();
  for (const item of items) {
    const d = item.date.split('T')[0]; // "YYYY-MM-DD" (server stores local time)
    if (d < startDate || d > endDate) continue;
    const t = item.date.split('T')[1]?.substring(0, 5) ?? ''; // "HH:MM"
    if (!byDate.has(d)) byDate.set(d, { ins: [], outs: [] });
    if (item.type === 'IN') byDate.get(d)!.ins.push(t);
    else byDate.get(d)!.outs.push(t);
  }
  const result: AbsentReportItem[] = [];
  for (const [date, { ins, outs }] of byDate.entries()) {
    if (ins.length === 0) continue; // OUT without IN — skip
    ins.sort(); outs.sort();
    const start  = ins[0];
    const finish = outs.length > 0 ? outs[outs.length - 1] : '';
    result.push({ date, score: 0, start, finish, status: finish ? 'CM/PT' : 'CM/NO' });
  }
  return result;
}

// ── Domain helpers ────────────────────────────────────────────────────────────

// Returns null when day has no attendance (status "NO/NO", empty start)
function absentToStatus(rec: AbsentReportItem): 'Hadir' | 'Terlambat' | null {
  if (!rec.start || rec.status.split('/')[0] === 'NO') return null;
  return rec.status.split('/')[0] === 'T' ? 'Terlambat' : 'Hadir';
}

function getDayStatus(
  date: string,
  absentMap: Map<string, AbsentReportItem>,
  permitMap: Map<string, PermitReportItem>,
): AttendanceStatus {
  const absent = absentMap.get(date);
  if (absent) {
    const st = absentToStatus(absent);
    if (st !== null) return st;
  }
  if (permitMap.has(date)) return 'Izin';
  return 'Alpha';
}

// ── Data builders ─────────────────────────────────────────────────────────────

interface WeekDayData {
  key: string; label: string; num: number;
  isSelected: boolean; status: AttendanceStatus | null;
}

function buildWeekStrip(
  dateStr: string,
  absentMap: Map<string, AbsentReportItem>,
  permitMap: Map<string, PermitReportItem>,
  todayStr: string,
  isActive: boolean,
): WeekDayData[] {
  const mon = getMonday(dateStr);
  return ['Sn','Sl','Rb','Km','Jm','Sb','Mg'].map((label, i) => {
    const day = new Date(mon); day.setDate(mon.getDate() + i);
    const key = toDateStr(day);
    let status: AttendanceStatus | null = null;
    if (i < 6 && key <= todayStr) {
      status = isActive ? getDayStatus(key, absentMap, permitMap) : null;
    }
    return { key, label, num: day.getDate(), isSelected: key === dateStr, status };
  });
}

export interface RekapItem {
  date: string; status: AttendanceStatus;
  start: string | null; finish: string | null; permitName: string | null;
}

export interface MonthStats {
  hadir: number; terlambat: number; izin: number; alpha: number;
  kerja: number; persen: number; rekapList: RekapItem[];
  hasData: boolean; // false when the period is fully past with no attendance/permit records
}

// Build stats for any date range
function computeRangeStats(
  startStr: string, endStr: string,
  absentData: AbsentReportItem[], permitData: PermitReportItem[],
): MonthStats {
  const todayStr = toDateStr(new Date());
  const effectiveEnd = endStr > todayStr ? todayStr : endStr;

  const absentMap = new Map(absentData.map(r => [r.date, r]));
  const permitMap = new Map(permitData.map(r => [r.date, r]));

  const anyPresent = absentData.some(r => r.date >= startStr && r.date <= effectiveEnd && !!r.start);
  const anyPermit  = permitData.some(r => r.date >= startStr && r.date <= effectiveEnd);
  const hasData    = anyPresent || anyPermit;

  if (!hasData) {
    return { hadir: 0, terlambat: 0, izin: 0, alpha: 0, kerja: 0, persen: 0, rekapList: [], hasData: false };
  }

  // Hitung Alpha mulai dari hari pertama ada aktivitas, bukan dari awal bulan
  // Agar user baru yang dibuat di tengah bulan tidak mendapat Alpha untuk hari sebelum bergabung
  const firstPresent = absentData.filter(r => !!r.start && r.date >= startStr).map(r => r.date).sort().at(0);
  const firstPermit  = permitData.filter(r => r.date >= startStr).map(r => r.date).sort().at(0);
  const candidates   = [firstPresent, firstPermit].filter(Boolean) as string[];
  const effectiveStart = candidates.length > 0 ? candidates.sort().at(0)! : startStr;

  let kerja = 0, hadir = 0, terlambat = 0, izin = 0, alpha = 0;
  const rekapList: RekapItem[] = [];

  const cur = new Date(effectiveStart + 'T00:00:00');
  const end = new Date(effectiveEnd + 'T00:00:00');
  while (cur <= end) {
    const ds = toDateStr(cur);
    if (cur.getDay() !== 0) {
      kerja++;
      const absent = absentMap.get(ds);
      const presentStatus = absent ? absentToStatus(absent) : null;
      const permit = permitMap.get(ds);
      if (presentStatus) {
        if (presentStatus === 'Terlambat') terlambat++; else hadir++;
        rekapList.push({ date: ds, status: presentStatus,
          start: absent!.start || null, finish: absent!.finish || null, permitName: null });
      } else if (permit) {
        izin++;
        rekapList.push({ date: ds, status: 'Izin',
          start: null, finish: null, permitName: permit.permit });
      } else {
        alpha++;
        rekapList.push({ date: ds, status: 'Alpha',
          start: null, finish: null, permitName: null });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  rekapList.sort((a, b) => b.date.localeCompare(a.date));
  const persen = kerja > 0 ? Math.round((hadir + terlambat) / kerja * 100) : 0;
  return { hadir, terlambat, izin, alpha, kerja, persen, rekapList, hasData: true };
}

function computeMonthStats(
  year: number, monthIdx: number,
  absentData: AbsentReportItem[], permitData: PermitReportItem[],
): MonthStats {
  const [s, e] = getMonthRange(year, monthIdx);
  return computeRangeStats(s, e, absentData, permitData);
}

interface BarDayData { day: string; persen: number; status: AttendanceStatus }

// Weekly bar chart: Mon-Sat per week (M1–M4/5) across the full month.
// Better for Bulanan view than a single-week daily chart — shows monthly trend at a glance.
function computeWeeklyBars(
  year: number, monthIdx: number,
  absentData: AbsentReportItem[], permitData: PermitReportItem[],
): BarDayData[] {
  const todayStr   = toDateStr(new Date());
  const [mStart, mEnd] = getMonthRange(year, monthIdx);
  const absentMap  = new Map(absentData.map(r => [r.date, r]));
  const permitMap  = new Map(permitData.map(r => [r.date, r]));

  // Find Monday on or before the first day of the month
  const firstDay = new Date(mStart + 'T00:00:00');
  const startDow = firstDay.getDay();
  const firstMon = new Date(firstDay);
  firstMon.setDate(firstDay.getDate() - (startDow === 0 ? 6 : startDow - 1));

  const bars: BarDayData[] = [];
  const cur = new Date(firstMon);

  while (toDateStr(cur) <= mEnd) {
    const weekLabel = `M${bars.length + 1}`;
    // Mon–Sat of this week, filtered to the month
    const daysInMonth: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(cur); d.setDate(cur.getDate() + i);
      const ds = toDateStr(d);
      if (ds >= mStart && ds <= mEnd) daysInMonth.push(ds);
    }
    if (daysInMonth.length === 0) { cur.setDate(cur.getDate() + 7); continue; }

    const pastDays = daysInMonth.filter(d => d <= todayStr);
    if (pastDays.length === 0) {
      // All days in this week are future
      bars.push({ day: weekLabel, persen: 0, status: 'Alpha' });
    } else {
      let hadirCount = 0;
      for (const ds of pastDays) {
        const absent = absentMap.get(ds);
        const st = absent ? absentToStatus(absent) : null;
        if (st || permitMap.has(ds)) hadirCount++;
      }
      const persen = Math.round(hadirCount / pastDays.length * 100);
      const status: AttendanceStatus =
        hadirCount === 0 ? 'Alpha' : persen >= 80 ? 'Hadir' : 'Terlambat';
      bars.push({ day: weekLabel, persen, status });
    }
    cur.setDate(cur.getDate() + 7);
  }
  return bars;
}

interface YearMonthData { persen: number; hadir: number; kerja: number }

function computeYearlyData(
  year: number,
  absentData: AbsentReportItem[],
  permitData: PermitReportItem[],
): YearMonthData[] {
  const todayStr = toDateStr(new Date());
  return Array.from({ length: 12 }, (_, mi) => {
    const [s, e] = getMonthRange(year, mi);
    if (s > todayStr) return { persen: 0, hadir: 0, kerja: 0 };
    const hadir = absentData.filter(r => r.date >= s && r.date <= e && !!r.start).length;
    const hasPermit = permitData.some(r => r.date >= s && r.date <= e);
    // No check-ins and no permits = no employment data for this month
    if (hadir === 0 && !hasPermit) return { persen: 0, hadir: 0, kerja: 0 };
    // Cap to working days up to today so the current month percentage is fair
    const effectiveEnd = e > todayStr ? todayStr : e;
    const kerja = countRangeWorkdays(s, effectiveEnd);
    return { kerja, hadir, persen: kerja > 0 ? Math.round(hadir / kerja * 100) : 0 };
  });
}

// ── Shared StatsAndRekap component ────────────────────────────────────────────

function StatsAndRekap({
  stats, showChart = false, barData, chartTrig,
}: {
  stats: MonthStats; showChart?: boolean;
  barData?: BarDayData[]; chartTrig?: number;
}) {
  return (
    <>
      <View style={styles.statGrid}>
        {([
          { icon: 'checkmark-circle' as IonName, num: stats.hadir,     label: 'Hadir',     color: Colors.statusHadir     },
          { icon: 'document-text'    as IonName, num: stats.izin,      label: 'Izin',      color: Colors.statusIzin      },
          { icon: 'close-circle'     as IonName, num: stats.alpha,     label: 'Alpha',     color: Colors.statusAlpha     },
          { icon: 'time'             as IonName, num: stats.terlambat, label: 'Terlambat', color: Colors.statusTerlambat },
        ]).map(item => (
          <View key={item.label} style={[styles.statCard, Shadow.sm]}>
            <Ionicons name={item.icon} size={22} color="#AAAAAA" />
            <Text style={[styles.statNum, { color: item.color }]}>{item.num}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.chartCard, Shadow.sm]}>
        <Text style={styles.chartTitle}>Tingkat Kehadiran</Text>
        <Text style={styles.rateNum}>{stats.persen}%</Text>
        <Text style={styles.rateSub}>Dari {stats.kerja} hari kerja</Text>
        <View style={styles.progWrap}>
          <View style={[styles.progBar, { width: `${stats.persen}%` }]} />
        </View>
        {showChart && barData && chartTrig !== undefined && (
          <>
            <AnimatedBarChart data={barData} trigger={chartTrig} />
            <View style={styles.legend}>
              {[
                { color: Colors.primary,    label: '≥80% hadir'   },
                { color: Colors.accentDark, label: '40–79%'        },
                { color: Colors.border,     label: '<40% / belum'  },
              ].map(l => (
                <View key={l.label} style={styles.lgd}>
                  <View style={[styles.ldot, { backgroundColor: l.color }]} />
                  <Text style={styles.lgdText}>{l.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.rekapSection}>
        <Text style={styles.rekapTitle}>Rekap Detail</Text>
        {stats.rekapList.length === 0 ? (
          <View style={[styles.emptyBox, Shadow.sm]}>
            <Ionicons name="calendar-outline" size={36} color={Colors.textHint} />
            <Text style={styles.emptyText}>Belum ada data pada periode ini</Text>
          </View>
        ) : (
          stats.rekapList.slice(0, 30).map((item, idx) => {
            const sc   = STATUS_CFG[item.status] ?? STATUS_CFG['Alpha'];
            const d    = new Date(item.date + 'T00:00:00');
            const tgl  = String(d.getDate()).padStart(2, '0');
            const bln  = BULAN_SINGKAT[d.getMonth()];
            const hari = d.toLocaleDateString('id-ID', { weekday: 'long' });
            const waktu = item.start && item.finish
              ? `${item.start} – ${item.finish}`
              : item.permitName ?? (item.status === 'Alpha' ? 'Tidak hadir' : item.status);
            return (
              <View key={idx} style={[styles.rekapItem, Shadow.sm]}>
                <View style={styles.rekapDate}>
                  <Text style={styles.rekapDay}>{tgl}</Text>
                  <Text style={styles.rekapMon}>{bln}</Text>
                </View>
                <View style={styles.rekapInfo}>
                  <Text style={styles.rekapHari}>{hari}</Text>
                  <View style={styles.rekapChips}>
                    <View style={[styles.rekapChip, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.rekapChipText, { color: sc.color }]}>{item.status}</Text>
                    </View>
                    {waktu ? (
                      <View style={[styles.rekapChip, { backgroundColor: Colors.background }]}>
                        <Text style={[styles.rekapChipText, { color: Colors.textSecondary }]}>{waktu}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Ionicons name={sc.icon} size={20} color={sc.color} />
              </View>
            );
          })
        )}
      </View>
    </>
  );
}

// ── AnimatedBarChart ──────────────────────────────────────────────────────────

function AnimatedBarChart({ data, trigger }: { data: BarDayData[]; trigger: number }) {
  // Sync animated-value array when data length changes (weekly bars: 4–5 items)
  const animsRef = useRef<Animated.Value[]>([]);
  if (animsRef.current.length !== data.length) {
    animsRef.current = data.map(() => new Animated.Value(0));
  }
  const anims = animsRef.current;
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    anims.forEach(a => a.setValue(0));
    Animated.stagger(80, data.map((d, i) =>
      Animated.spring(anims[i], {
        toValue: (d.persen / 100) * BAR_MAX_H,
        useNativeDriver: false, tension: 60, friction: 8,
      })
    )).start();
  }, [trigger]);

  return (
    <View style={{ marginTop: 16 }}>
      <View style={chartStyles.chartContainer}>
        {data.map((d, i) => {
          const color = BAR_COLOR[d.status] ?? Colors.border;
          const isAct = active === i;
          return (
            <TouchableOpacity
              key={d.day} style={chartStyles.barGroup} activeOpacity={0.8}
              onPress={() => setActive(isAct ? null : i)}
            >
              {isAct && d.persen > 0 && (
                <View style={chartStyles.tooltip}>
                  <Text style={chartStyles.tooltipText}>{d.persen}%</Text>
                  <View style={chartStyles.tooltipArrow} />
                </View>
              )}
              <View style={[chartStyles.barTrack, { height: BAR_MAX_H }]}>
                <Animated.View style={[chartStyles.barFill, {
                  backgroundColor: color, opacity: isAct ? 1 : 0.85, height: anims[i],
                }]} />
              </View>
              <Text style={[chartStyles.dayLabel, isAct && { color: Colors.primary, fontFamily: 'Poppins_700Bold' }]}>
                {d.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── TahunanBulanGrid ──────────────────────────────────────────────────────────

function TahunanBulanGrid({ data, tahun, animTrigger, selectedBulanIdx, setSelectedBulanIdx }: {
  data: YearMonthData[]; tahun: number; animTrigger: number;
  selectedBulanIdx: number | null; setSelectedBulanIdx: (i: number | null) => void;
}) {
  const progAnims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    progAnims.forEach(a => a.setValue(0));
    Animated.stagger(55, data.map((d, i) =>
      Animated.spring(progAnims[i], { toValue: d.persen, useNativeDriver: false, tension: 55, friction: 9 })
    )).start();
  }, [tahun, animTrigger]);

  const todayStr = toDateStr(new Date());

  return (
    <View style={styles.bulanGrid}>
      {data.map((item, mi) => {
        // Month has started = interactive; future months = not interactive
        const hasStarted = toDateStr(new Date(tahun, mi, 1)) <= todayStr;
        const hasData    = item.kerja > 0;
        const terpilih   = selectedBulanIdx === mi;
        const warna      = item.persen >= 90 ? Colors.statusHadir
          : item.persen >= 75 ? Colors.statusIzin
          : item.persen > 0   ? Colors.statusAlpha
          : Colors.textHint;
        const animWidth = progAnims[mi].interpolate({
          inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp',
        });
        return (
          <TouchableOpacity
            key={mi}
            style={[
              styles.bulanCard, Shadow.sm,
              !hasStarted && styles.bulanCardInaktif,
              terpilih && styles.bulanCardTerpilih,
            ]}
            onPress={() => hasStarted && setSelectedBulanIdx(terpilih ? null : mi)}
            activeOpacity={hasStarted ? 0.75 : 1}
          >
            <Text style={[styles.bulanNama, terpilih && { color: Colors.primary }]}>{BULAN_SINGKAT[mi]}</Text>
            {hasData ? (
              <>
                <Text style={[styles.bulanPersen, { color: warna }]}>{item.persen}%</Text>
                <View style={styles.bulanProgWrap}>
                  <Animated.View style={[styles.bulanProgBar, { width: animWidth, backgroundColor: warna }]} />
                </View>
                <Text style={styles.bulanDetail}>{item.hadir}/{item.kerja}</Text>
              </>
            ) : hasStarted ? (
              <Text style={[styles.bulanDetail, { textAlign: 'center', marginTop: 2, lineHeight: 13 }]}>
                {'Belum\nada data'}
              </Text>
            ) : (
              <Text style={styles.bulanBelum}>–</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function LaporanScreen() {
  const today    = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), []);

  const [periode, setPeriode] = useState<Periode>('Bulanan');

  // Harian nav
  const [hariTerpilih, setHariTerpilih] = useState(todayStr);

  // Bulanan nav
  const [bulanIdx,   setBulanIdx]   = useState(today.getMonth());
  const [tahunBulan, setTahunBulan] = useState(today.getFullYear());

  // Tahunan nav
  const [tahun,            setTahun]            = useState(today.getFullYear());
  const [selectedBulanIdx, setSelectedBulanIdx] = useState<number | null>(null);

  // Kustom filter
  const firstDayThisMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), []);
  const [filterStart,      setFilterStart]      = useState<Date>(firstDayThisMonth);
  const [filterEnd,        setFilterEnd]        = useState<Date>(today);
  const [showPickerStart,  setShowPickerStart]  = useState(false);
  const [showPickerEnd,    setShowPickerEnd]    = useState(false);
  const [filterApplied,    setFilterApplied]    = useState(false);
  const [filterAbsent,     setFilterAbsent]     = useState<AbsentReportItem[]>([]);
  const [filterPermit,     setFilterPermit]     = useState<PermitReportItem[]>([]);
  const [filterLoading,    setFilterLoading]    = useState(false);

  // Regular data
  const [absentData, setAbsentData] = useState<AbsentReportItem[]>([]);
  const [permitData, setPermitData] = useState<PermitReportItem[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [chartTrig,  setChartTrig]  = useState(0);

  // Current-month absent data for Harian monthly score card (score field only available from /absent/report)
  const [curMonthAbsent, setCurMonthAbsent] = useState<AbsentReportItem[]>([]);

  // Cache history to avoid redundant API calls within the same session
  const historyCache = useRef<AbsentHistoryItem[] | null>(null);

  // Fetch absent data: use /absent/report for current-month periods (has CM/T status),
  // fall back to /absent/history for past periods and year view (report ignores date params).
  const fetchAbsent = async (start: string, finish: string, forceHistory = false) => {
    const currentTodayStr = toDateStr(new Date());
    const useReport = !forceHistory && finish >= currentTodayStr;
    if (useReport) {
      const res = await getAbsentReport(start, finish);
      return (res.data.data ?? []).map(r => ({ ...r, date: normalizeDate(r.date) }));
    }
    if (!historyCache.current) {
      const res = await getAllAbsentHistory();
      historyCache.current = res.data.data ?? [];
    }
    return buildAbsentFromHistory(historyCache.current, start, finish);
  };

  const loadData = useCallback(async () => {
    if (periode === 'Kustom') return;
    let start: string, finish: string;
    if (periode === 'Harian') {
      [start, finish] = getWeekRange(hariTerpilih);
    } else if (periode === 'Bulanan') {
      [start, finish] = getMonthRange(tahunBulan, bulanIdx);
    } else {
      [start, finish] = getYearRange(tahun);
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [absent, permit] = await Promise.all([
        fetchAbsent(start, finish, periode === 'Tahunan'),
        getPermitReport(start, finish).then(r => r.data.data ?? []),
      ]);
      setAbsentData(absent);
      setPermitData(permit);
      setChartTrig(t => t + 1);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Gagal memuat data');
    } finally { setLoading(false); }
  }, [periode, hariTerpilih, bulanIdx, tahunBulan, tahun]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load current month's absent report once when Harian tab is activated.
  // /absent/report always returns the current month regardless of params, so this gives real scores.
  useEffect(() => {
    if (periode !== 'Harian') return;
    const now = new Date();
    const [mStart, mEnd] = getMonthRange(now.getFullYear(), now.getMonth());
    getAbsentReport(mStart, mEnd)
      .then(res => setCurMonthAbsent((res.data.data ?? []).map(r => ({ ...r, date: normalizeDate(r.date) }))))
      .catch(() => {});
  }, [periode]);

  const handleFilterApply = async () => {
    const start  = toDateStr(filterStart);
    const finish = toDateStr(filterEnd);
    if (start > finish) return;
    setFilterLoading(true);
    try {
      const [absent, permit] = await Promise.all([
        fetchAbsent(start, finish),
        getPermitReport(start, finish).then(r => r.data.data ?? []),
      ]);
      setFilterAbsent(absent);
      setFilterPermit(permit);
      setFilterApplied(true);
    } catch { /* keep */ } finally { setFilterLoading(false); }
  };

  // Derived
  const absentMap = useMemo(() => new Map(absentData.map(r => [r.date, r])), [absentData]);
  const permitMap = useMemo(() => new Map(permitData.map(r => [r.date, r])), [permitData]);

  // Build merged absentMap: override history status with real report status for current-month days
  const mergedAbsentMap = useMemo(() => {
    if (curMonthAbsent.length === 0) return absentMap;
    const merged = new Map(absentMap);
    for (const r of curMonthAbsent) {
      const existing = merged.get(r.date);
      if (existing) merged.set(r.date, { ...existing, status: r.status, score: r.score });
    }
    return merged;
  }, [absentMap, curMonthAbsent]);

  // True jika user punya aktivitas nyata di periode yang dimuat atau di bulan ini
  // Dipakai untuk membedakan "Alpha betulan" vs "belum ada data" (user baru)
  const hasAnyActivity = useMemo(
    () =>
      absentData.some(r => !!r.start) ||
      curMonthAbsent.some(r => !!r.start) ||
      permitData.length > 0,
    [absentData, curMonthAbsent, permitData],
  );

  const weekStrip = useMemo(
    () => buildWeekStrip(hariTerpilih, mergedAbsentMap, permitMap, todayStr, hasAnyActivity),
    [hariTerpilih, mergedAbsentMap, permitMap, hasAnyActivity],
  );
  const selAbsent  = useMemo(() => absentMap.get(hariTerpilih), [hariTerpilih, absentMap]);
  const selPermit  = useMemo(() => permitMap.get(hariTerpilih), [hariTerpilih, permitMap]);

  // truthy only when the absent record reflects actual presence (not a "NO/NO" placeholder)
  const selPresentAbsent = useMemo(
    () => (selAbsent && absentToStatus(selAbsent) !== null) ? selAbsent : undefined,
    [selAbsent],
  );

  // For days from /absent/history, status is hardcoded CM — use curMonthAbsent for real status/score
  const selReportAbsent = useMemo(
    () => curMonthAbsent.find(r => r.date === hariTerpilih),
    [curMonthAbsent, hariTerpilih],
  );

  // Merge: history has real start/finish times; report has real status/score
  const selEffectiveAbsent = useMemo<AbsentReportItem | undefined>(() => {
    if (!selPresentAbsent) return undefined;
    if (!selReportAbsent)  return selPresentAbsent;
    return { ...selPresentAbsent, status: selReportAbsent.status, score: selReportAbsent.score };
  }, [selPresentAbsent, selReportAbsent]);

  // Status for selected day — use real report status to override hardcoded CM from history
  const selStatus = useMemo<AttendanceStatus>(() => {
    if (selEffectiveAbsent) {
      const s = absentToStatus(selEffectiveAbsent);
      if (s) return s;
    }
    return getDayStatus(hariTerpilih, absentMap, permitMap) ?? 'Alpha';
  }, [selEffectiveAbsent, hariTerpilih, absentMap, permitMap]);

  const selScore = useMemo(() => selEffectiveAbsent?.score ?? 0, [selEffectiveAbsent]);

  const monthStats = useMemo(
    () => computeMonthStats(tahunBulan, bulanIdx, absentData, permitData),
    [tahunBulan, bulanIdx, absentData, permitData],
  );
  const barData = useMemo(
    () => computeWeeklyBars(tahunBulan, bulanIdx, absentData, permitData),
    [tahunBulan, bulanIdx, absentData, permitData],
  );
  const yearlyData = useMemo(() => computeYearlyData(tahun, absentData, permitData), [tahun, absentData, permitData]);

  const rataKehadiran = useMemo(() => {
    const aktif = yearlyData.filter(d => d.kerja > 0);
    return aktif.length ? Math.round(aktif.reduce((s, d) => s + d.persen, 0) / aktif.length) : 0;
  }, [yearlyData]);
  const totalHadir = useMemo(() => yearlyData.reduce((s, d) => s + d.hadir, 0), [yearlyData]);
  const totalKerja = useMemo(() => yearlyData.reduce((s, d) => s + d.kerja, 0), [yearlyData]);
  const totalIzin  = useMemo(() => permitData.length, [permitData]);
  const totalAlpha = useMemo(() => Math.max(0, totalKerja - totalHadir - totalIzin), [totalKerja, totalHadir, totalIzin]);

  const filterStats = useMemo(() => {
    if (!filterApplied) return null;
    return computeRangeStats(toDateStr(filterStart), toDateStr(filterEnd), filterAbsent, filterPermit);
  }, [filterApplied, filterStart, filterEnd, filterAbsent, filterPermit]);

  // Monthly score stats for Harian view — uses curMonthAbsent which has real score values
  const monthlyScoreStats = useMemo(() => {
    const scored = curMonthAbsent.filter(r => r.score > 0);
    if (scored.length === 0) return null;
    const now = new Date();
    const todStr = toDateStr(now);
    const [mStart] = getMonthRange(now.getFullYear(), now.getMonth());
    const monthScored = scored.filter(r => r.date >= mStart && r.date <= todStr);
    if (monthScored.length === 0) return null;
    const totalScore  = monthScored.reduce((s, r) => s + r.score, 0);
    const workdays    = countRangeWorkdays(mStart, todStr);
    const maxScore    = workdays * 8;
    return {
      totalScore,
      maxScore,
      presentDays: monthScored.length,
      workdays,
      persen: maxScore > 0 ? Math.round(totalScore / maxScore * 100) : 0,
      bulan: BULAN_PANJANG[now.getMonth()],
    };
  }, [curMonthAbsent]);

  const pindahHari = (arah: number) => {
    const d = new Date(hariTerpilih + 'T00:00:00'); d.setDate(d.getDate() + arah);
    setHariTerpilih(toDateStr(d));
  };
  const prevBulan = () => {
    if (bulanIdx === 0) { setBulanIdx(11); setTahunBulan(t => t - 1); }
    else setBulanIdx(b => b - 1);
  };
  const nextBulan = () => {
    if (bulanIdx === 11) { setBulanIdx(0); setTahunBulan(t => t + 1); }
    else setBulanIdx(b => b + 1);
  };

  const hariLabel = useMemo(
    () => new Date(hariTerpilih + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }),
    [hariTerpilih],
  );
  const isFuture = hariTerpilih > todayStr;
  const isSunday = new Date(hariTerpilih + 'T00:00:00').getDay() === 0;

  return (
    <View style={styles.root}>
      <AppHeader title="Laporan Kehadiran" right={<HeaderActions />} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Tab Toggle (scrollable) ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.togWrap}>
          {(['Harian', 'Bulanan', 'Tahunan', 'Kustom'] as Periode[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.togBtn, periode === p && styles.togBtnOn]}
              onPress={() => { setPeriode(p); if (p !== 'Kustom') setFilterApplied(false); }}
            >
              {p === 'Kustom' && (
                <Ionicons name="calendar-outline" size={13} color={periode === p ? Colors.primary : Colors.textTertiary} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.togText, periode === p && styles.togTextOn]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Memuat data...</Text>
          </View>
        )}
        {!loading && loadError && (
          <View style={styles.errorRow}>
            <Ionicons name="warning-outline" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={loadData}>
              <Text style={styles.retryText}>Coba lagi</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ HARIAN ══ */}
        {periode === 'Harian' && (
          <>
            <View style={[styles.navRow, Shadow.sm]}>
              <TouchableOpacity style={styles.navBtn} onPress={() => pindahHari(-1)}>
                <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.navTitle}>{hariLabel}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => pindahHari(1)}>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.weekStrip, Shadow.sm]}>
              {weekStrip.map(day => {
                const sc = day.status ? STATUS_CFG[day.status] : null;
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[styles.weekDay, day.isSelected && styles.weekDaySelected]}
                    onPress={() => setHariTerpilih(day.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.weekDayLabel, day.isSelected && styles.weekDayLabelSelected]}>{day.label}</Text>
                    <Text style={[styles.weekDayNum,   day.isSelected && styles.weekDayNumSelected]}>{day.num}</Text>
                    <View style={[styles.weekDot, { backgroundColor: sc ? sc.color : Colors.border }]} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {(isFuture || isSunday) ? (
              <View style={[styles.hariCard, Shadow.sm, { borderLeftColor: Colors.border }]}>
                <View style={styles.hariEmpty}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.textHint} />
                  <Text style={styles.hariEmptyText}>
                    {isSunday ? 'Hari Minggu' : 'Tanggal belum berlangsung'}
                  </Text>
                </View>
              </View>
            ) : selPresentAbsent ? (
              <View style={[styles.hariCard, Shadow.sm, { borderLeftColor: STATUS_CFG[selStatus]?.color ?? Colors.border }]}>
                <View style={[styles.hariStatusBadge, { backgroundColor: STATUS_CFG[selStatus]?.bg }]}>
                  <Ionicons name={STATUS_CFG[selStatus]?.icon ?? 'help-circle-outline'} size={22} color={STATUS_CFG[selStatus]?.color} />
                  <Text style={[styles.hariStatusText, { color: STATUS_CFG[selStatus]?.color }]}>{selStatus}</Text>
                </View>
                {([
                  { icon: 'log-in-outline'  as IonName, label: 'Jam Masuk',  val: selPresentAbsent.start  || '–', color: Colors.statusHadir },
                  { icon: 'log-out-outline' as IonName, label: 'Jam Keluar', val: selPresentAbsent.finish || '–', color: Colors.primary     },
                ] as const).map(row => (
                  <View key={row.label} style={styles.hariRow}>
                    <View style={styles.hariRowLeft}>
                      <Ionicons name={row.icon} size={15} color={Colors.textHint} />
                      <Text style={styles.hariRowLabel}>{row.label}</Text>
                    </View>
                    <Text style={[styles.hariRowVal, { color: row.color }]}>{row.val}</Text>
                  </View>
                ))}
                {selScore > 0 && (
                  <View style={styles.hariRow}>
                    <View style={styles.hariRowLeft}>
                      <Ionicons name="stats-chart-outline" size={15} color={Colors.textHint} />
                      <Text style={styles.hariRowLabel}>Skor</Text>
                    </View>
                    <Text style={[styles.hariRowVal, { color: Colors.primary }]}>
                      {selScore} poin
                    </Text>
                  </View>
                )}
              </View>
            ) : selPermit ? (
              <View style={[styles.hariCard, Shadow.sm, { borderLeftColor: STATUS_CFG['Izin'].color }]}>
                <View style={[styles.hariStatusBadge, { backgroundColor: STATUS_CFG['Izin'].bg }]}>
                  <Ionicons name={STATUS_CFG['Izin'].icon} size={22} color={STATUS_CFG['Izin'].color} />
                  <Text style={[styles.hariStatusText, { color: STATUS_CFG['Izin'].color }]}>Izin</Text>
                </View>
                <View style={styles.hariRow}>
                  <View style={styles.hariRowLeft}>
                    <Ionicons name="document-text-outline" size={15} color={Colors.textHint} />
                    <Text style={styles.hariRowLabel}>Keterangan</Text>
                  </View>
                  <Text style={[styles.hariRowVal, { color: Colors.statusIzin }]}>{selPermit.permit}</Text>
                </View>
              </View>
            ) : hasAnyActivity ? (
              <View style={[styles.hariCard, Shadow.sm, { borderLeftColor: STATUS_CFG['Alpha'].color }]}>
                <View style={[styles.hariStatusBadge, { backgroundColor: STATUS_CFG['Alpha'].bg }]}>
                  <Ionicons name={STATUS_CFG['Alpha'].icon} size={22} color={STATUS_CFG['Alpha'].color} />
                  <Text style={[styles.hariStatusText, { color: STATUS_CFG['Alpha'].color }]}>Alpha</Text>
                </View>
                <View style={styles.hariEmpty}>
                  <Text style={styles.hariEmptyText}>Tidak ada catatan kehadiran</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.hariCard, Shadow.sm, { borderLeftColor: Colors.border }]}>
                <View style={styles.hariEmpty}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.textHint} />
                  <Text style={styles.hariEmptyText}>Belum ada data absensi</Text>
                </View>
              </View>
            )}

            {/* Monthly score progress card */}
            {monthlyScoreStats && (
              <View style={[styles.skorBulanCard, Shadow.sm]}>
                <View style={styles.skorBulanHeader}>
                  <Ionicons name="stats-chart-outline" size={16} color={Colors.primary} />
                  <Text style={styles.skorBulanTitle}>Skor {monthlyScoreStats.bulan}</Text>
                  <Text style={styles.skorBulanPersen}>{monthlyScoreStats.persen}%</Text>
                </View>
                <View style={styles.skorBulanBarWrap}>
                  <View style={[styles.skorBulanBar, { width: `${monthlyScoreStats.persen}%` as any }]} />
                </View>
                <View style={styles.skorBulanFooter}>
                  <Text style={styles.skorBulanSub}>
                    {monthlyScoreStats.totalScore} / {monthlyScoreStats.maxScore} poin
                  </Text>
                  <Text style={styles.skorBulanSub}>
                    {monthlyScoreStats.presentDays} hadir dari {monthlyScoreStats.workdays} hari kerja
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* ══ BULANAN ══ */}
        {periode === 'Bulanan' && (
          <>
            <View style={[styles.navRow, Shadow.sm]}>
              <TouchableOpacity style={styles.navBtn} onPress={prevBulan}>
                <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.navTitle}>{BULAN_PANJANG[bulanIdx]} {tahunBulan}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={nextBulan}>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {monthStats.hasData ? (
              <StatsAndRekap stats={monthStats} showChart barData={barData} chartTrig={chartTrig} />
            ) : (
              <View style={[styles.emptyBox, Shadow.sm, { marginHorizontal: 14 }]}>
                <Ionicons name="calendar-outline" size={40} color={Colors.textHint} />
                <Text style={styles.emptyText}>Tidak ada data kehadiran untuk periode ini</Text>
              </View>
            )}
          </>
        )}

        {/* ══ TAHUNAN ══ */}
        {periode === 'Tahunan' && (
          <>
            <View style={[styles.navRow, Shadow.sm]}>
              <TouchableOpacity style={styles.navBtn} onPress={() => setTahun(t => t - 1)}>
                <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.navTitle}>Tahun {tahun}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => setTahun(t => t + 1)}>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.tahunSummary, Shadow.sm]}>
              <View style={styles.tahunSummaryLeft}>
                <Text style={styles.tahunLabel}>Rata-rata Kehadiran</Text>
                <Text style={styles.tahunPersen}>{rataKehadiran}%</Text>
                <Text style={styles.tahunSub}>Dari data tersedia</Text>
              </View>
              <View style={styles.tahunRingkasan}>
                {[
                  { label: 'Total Hadir', val: totalHadir, color: Colors.success    },
                  { label: 'Total Alpha', val: totalAlpha, color: Colors.error      },
                  { label: 'Total Izin',  val: totalIzin,  color: Colors.accentDark },
                ].map(row => (
                  <View key={row.label} style={styles.tahunRingRow}>
                    <Text style={[styles.tahunRingVal, { color: row.color }]}>{row.val}</Text>
                    <Text style={styles.tahunRingLabel}>{row.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TahunanBulanGrid
              data={yearlyData} tahun={tahun} animTrigger={chartTrig}
              selectedBulanIdx={selectedBulanIdx}
              setSelectedBulanIdx={setSelectedBulanIdx}
            />

            {selectedBulanIdx !== null && (() => {
              const d     = yearlyData[selectedBulanIdx];
              const alpha = Math.max(0, d.kerja - d.hadir);
              return (
                <View style={[styles.bulanDetailPanel, Shadow.sm]}>
                  <View style={styles.bulanDetailHeader}>
                    <Text style={styles.bulanDetailTitle}>
                      Detail — {BULAN_PANJANG[selectedBulanIdx]} {tahun}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedBulanIdx(null)}>
                      <Ionicons name="close-circle" size={20} color={Colors.textHint} />
                    </TouchableOpacity>
                  </View>
                  {d.kerja === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                      <Ionicons name="calendar-outline" size={32} color={Colors.textHint} />
                      <Text style={[styles.bulanDetailLabel, { textAlign: 'center' }]}>
                        Tidak ada data kehadiran untuk bulan ini
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.bulanDetailGrid}>
                      {([
                        { icon: 'checkmark-circle' as IonName, label: 'Hadir',      val: `${d.hadir} hari`,  color: Colors.statusHadir },
                        { icon: 'close-circle'     as IonName, label: 'Alpha',      val: `${alpha} hari`,    color: Colors.statusAlpha },
                        { icon: 'calendar'         as IonName, label: 'Hari Kerja', val: `${d.kerja} hari`,  color: Colors.textPrimary },
                        { icon: 'stats-chart'      as IonName, label: 'Kehadiran',  val: `${d.persen}%`,     color: Colors.primary     },
                      ] as const).map(row => (
                        <View key={row.label} style={styles.bulanDetailRow}>
                          <Ionicons name={row.icon} size={16} color={row.color} />
                          <Text style={styles.bulanDetailLabel}>{row.label}</Text>
                          <Text style={[styles.bulanDetailVal, { color: row.color }]}>{row.val}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}
          </>
        )}

        {/* ══ KUSTOM ══ */}
        {periode === 'Kustom' && (
          <>
            {/* Date range card */}
            <View style={[styles.filterCard, Shadow.sm]}>
              <View style={styles.filterCardHeader}>
                <Ionicons name="filter-outline" size={18} color={Colors.primary} />
                <Text style={styles.filterCardTitle}>Filter Rentang Tanggal</Text>
              </View>

              <Text style={styles.filterLabel}>DARI TANGGAL</Text>
              <TouchableOpacity style={styles.filterInput} onPress={() => setShowPickerStart(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={16} color="#AAAAAA" style={{ marginRight: 8 }} />
                <Text style={styles.filterInputText}>{fmtDisplayDate(filterStart)}</Text>
                <Ionicons name="chevron-down" size={14} color="#AAAAAA" />
              </TouchableOpacity>
              {showPickerStart && (
                <DateTimePicker
                  value={filterStart}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  maximumDate={today}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS === 'android') setShowPickerStart(false);
                    if (d) setFilterStart(d);
                  }}
                />
              )}

              <Text style={[styles.filterLabel, { marginTop: 12 }]}>SAMPAI TANGGAL</Text>
              <TouchableOpacity style={styles.filterInput} onPress={() => setShowPickerEnd(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={16} color="#AAAAAA" style={{ marginRight: 8 }} />
                <Text style={styles.filterInputText}>{fmtDisplayDate(filterEnd)}</Text>
                <Ionicons name="chevron-down" size={14} color="#AAAAAA" />
              </TouchableOpacity>
              {showPickerEnd && (
                <DateTimePicker
                  value={filterEnd}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  maximumDate={today}
                  minimumDate={filterStart}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS === 'android') setShowPickerEnd(false);
                    if (d) setFilterEnd(d);
                  }}
                />
              )}

              {/* Info range */}
              {filterStart <= filterEnd && (
                <View style={styles.filterRangeInfo}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
                  <Text style={styles.filterRangeText}>
                    {countRangeWorkdays(toDateStr(filterStart), toDateStr(filterEnd))} hari kerja dalam rentang ini
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.filterBtn, filterStart > filterEnd && styles.filterBtnDisabled]}
                onPress={handleFilterApply}
                disabled={filterLoading || filterStart > filterEnd}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.filterBtnGrad}
                >
                  {filterLoading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="search-outline" size={16} color="#fff" />
                        <Text style={styles.filterBtnText}>Tampilkan Laporan</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Results */}
            {filterApplied && filterStats && (
              <>
                <View style={styles.filterResultHeader}>
                  <Ionicons name="stats-chart-outline" size={16} color={Colors.primary} />
                  <Text style={styles.filterResultTitle}>
                    {fmtDisplayDate(filterStart)} – {fmtDisplayDate(filterEnd)}
                  </Text>
                </View>
                <StatsAndRekap stats={filterStats} showChart={false} />
              </>
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.background },

  // Tab toggle
  togWrap: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  togBtn:  {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: 8, backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  togBtnOn:  { backgroundColor: '#fff', borderColor: Colors.primary, ...Shadow.sm },
  togText:   { fontSize: FontSize.xs, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  togTextOn: { fontFamily: 'Poppins_700Bold', color: Colors.primary },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },
  errorRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 8, backgroundColor: Colors.errorLight, borderRadius: 10, padding: 12 },
  errorText:   { flex: 1, fontSize: FontSize.xs, color: Colors.error, fontFamily: 'Poppins_400Regular' },
  retryText:   { fontSize: FontSize.xs, color: Colors.primary, fontFamily: 'Poppins_600SemiBold' },

  navRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', margin: 14, marginBottom: 12, borderRadius: 14, padding: 12 },
  navBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },

  // Week strip (Harian)
  weekStrip:              { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 14, marginBottom: 12, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, justifyContent: 'space-around' },
  weekDay:                { alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 10, minWidth: 36 },
  weekDaySelected:        { backgroundColor: Colors.primary },
  weekDayLabel:           { fontSize: 10, fontFamily: 'Poppins_500Medium', color: Colors.textTertiary },
  weekDayLabelSelected:   { color: '#fff', fontFamily: 'Poppins_700Bold' },
  weekDayNum:             { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  weekDayNumSelected:     { color: '#fff' },
  weekDot:                { width: 6, height: 6, borderRadius: 3 },

  // Harian detail card
  hariCard:        { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 14, marginBottom: 12, padding: 18, borderLeftWidth: 5, ...Shadow.sm },
  hariStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, marginBottom: 14 },
  hariStatusText:  { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold' },
  hariRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.background },
  hariRowLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hariRowLabel:    { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: 'Poppins_400Regular' },
  hariRowVal:      { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold' },
  hariEmpty:       { alignItems: 'center', paddingVertical: 20, gap: 10 },
  hariEmptyText:   { fontSize: FontSize.sm, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },

  // Harian monthly score card
  skorBulanCard:   { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 14, marginBottom: 12, padding: 16 },
  skorBulanHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  skorBulanTitle:  { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary, flex: 1 },
  skorBulanPersen: { fontSize: FontSize.sm, fontFamily: 'Poppins_700Bold', color: Colors.primary },
  skorBulanBarWrap:{ backgroundColor: Colors.background, borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 10 },
  skorBulanBar:    { height: 8, borderRadius: 20, backgroundColor: Colors.primary },
  skorBulanFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  skorBulanSub:    { fontSize: FontSize.xs - 1, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },

  // Stats grid (shared)
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14, marginBottom: 12 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 4 },
  statNum:  { fontSize: FontSize.xxl, fontFamily: 'Poppins_700Bold' },
  statLabel:{ fontSize: FontSize.xs - 1, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },

  // Chart card (shared)
  chartCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 14, marginBottom: 12 },
  chartTitle: { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary, marginBottom: 8 },
  rateNum:    { fontSize: FontSize.xxxl, fontFamily: 'Poppins_700Bold', color: Colors.statusHadir, textAlign: 'center' },
  rateSub:    { fontSize: FontSize.xs - 1, color: Colors.textTertiary, textAlign: 'center', marginBottom: 10, fontFamily: 'Poppins_400Regular' },
  progWrap:   { backgroundColor: Colors.background, borderRadius: 20, height: 10, overflow: 'hidden', marginBottom: 6 },
  progBar:    { height: '100%', borderRadius: 20, backgroundColor: Colors.primary },
  legend:     { flexDirection: 'row', gap: 14, marginTop: 12 },
  lgd:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ldot:       { width: 8, height: 8, borderRadius: 4 },
  lgdText:    { fontSize: FontSize.xs - 1, color: Colors.textSecondary, fontFamily: 'Poppins_400Regular' },

  emptyBox:  { backgroundColor: '#fff', borderRadius: 14, padding: 30, alignItems: 'center', gap: 10, marginBottom: 10 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },

  // Rekap list (shared)
  rekapSection: { paddingHorizontal: 14 },
  rekapTitle:   { fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary, marginBottom: 10 },
  rekapItem:    { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  rekapDate:    { width: 44, height: 44, backgroundColor: Colors.primaryXLight, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rekapDay:     { fontSize: 17, fontFamily: 'Poppins_700Bold', color: Colors.primary, lineHeight: 20 },
  rekapMon:     { fontSize: 9, color: Colors.primary, textTransform: 'uppercase', fontFamily: 'Poppins_500Medium' },
  rekapInfo:    { flex: 1 },
  rekapHari:    { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  rekapChips:   { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  rekapChip:    { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  rekapChipText:{ fontSize: FontSize.xs - 2, fontFamily: 'Poppins_500Medium' },

  // Tahunan
  tahunSummary:     { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 14, marginBottom: 12, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  tahunSummaryLeft: { flex: 1, alignItems: 'center' },
  tahunLabel:       { fontSize: FontSize.xs - 1, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },
  tahunPersen:      { fontSize: FontSize.xxxl, fontFamily: 'Poppins_700Bold', color: Colors.primary },
  tahunSub:         { fontSize: FontSize.xs - 2, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },
  tahunRingkasan:   { flex: 1, gap: 8 },
  tahunRingRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tahunRingVal:     { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', width: 36 },
  tahunRingLabel:   { fontSize: FontSize.xs - 1, color: Colors.textSecondary, fontFamily: 'Poppins_400Regular' },

  bulanGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14 },
  bulanCard:         { width: '30%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center' },
  bulanCardInaktif:  { opacity: 0.4 },
  bulanCardTerpilih: { borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.primaryXLight },
  bulanNama:         { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary, marginBottom: 4 },
  bulanPersen:       { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold' },
  bulanProgWrap:     { width: '100%', height: 5, backgroundColor: Colors.background, borderRadius: 10, overflow: 'hidden', marginVertical: 5 },
  bulanProgBar:      { height: '100%', borderRadius: 10 },
  bulanDetail:       { fontSize: FontSize.xs - 2, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },
  bulanBelum:        { fontSize: FontSize.lg, color: Colors.textHint },

  bulanDetailPanel:  { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 14, marginTop: 4, marginBottom: 4, padding: 16 },
  bulanDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.background },
  bulanDetailTitle:  { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  bulanDetailGrid:   { gap: 2 },
  bulanDetailRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.background },
  bulanDetailLabel:  { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary },
  bulanDetailVal:    { fontSize: FontSize.sm, fontFamily: 'Poppins_700Bold' },

  // Kustom filter
  filterCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 14, marginBottom: 12, padding: 18,
  },
  filterCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  filterCardTitle:  { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  filterLabel:      { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: 8 },
  filterInput:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 12, height: 48,
  },
  filterInputText:  { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: Colors.textPrimary },
  filterRangeInfo:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 4 },
  filterRangeText:  { fontSize: FontSize.xs - 1, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },
  filterBtn:        { marginTop: 16, borderRadius: Radius.md, overflow: 'hidden' },
  filterBtnDisabled:{ opacity: 0.4 },
  filterBtnGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  filterBtnText:    { color: '#fff', fontSize: FontSize.sm, fontFamily: 'Poppins_700Bold' },

  filterResultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, marginBottom: 10,
  },
  filterResultTitle: {
    fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold',
    color: Colors.textSecondary, flex: 1,
  },
});

const chartStyles = StyleSheet.create({
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingBottom: 4 },
  barGroup:   { flex: 1, alignItems: 'center', gap: 5, position: 'relative' },
  barTrack:   { width: '80%', backgroundColor: Colors.background, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:    { width: '100%', borderRadius: 6 },
  dayLabel:   { fontSize: 10, color: Colors.textTertiary, fontFamily: 'Poppins_500Medium' },
  tooltip:    { position: 'absolute', top: -28, backgroundColor: Colors.textPrimary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, zIndex: 10, alignItems: 'center' },
  tooltipText:  { color: '#fff', fontSize: 10, fontFamily: 'Poppins_700Bold' },
  tooltipArrow: { position: 'absolute', bottom: -4, width: 8, height: 8, backgroundColor: Colors.textPrimary, transform: [{ rotate: '45deg' }], borderRadius: 1 },
});
