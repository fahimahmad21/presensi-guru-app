import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorPalette } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { FontSize, Radius, Shadow, Spacing } from '../constants/Theme';

const BULAN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI_PANJANG  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const HARI_SINGKAT  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CalendarPickerModalProps {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

export default function CalendarPickerModal({
  visible, value, onSelect, onClose, minimumDate, maximumDate,
}: CalendarPickerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [viewYear,  setViewYear]  = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  useEffect(() => {
    if (visible) {
      setViewYear(value.getFullYear());
      setViewMonth(value.getMonth());
    }
  }, [visible, value]);

  const minStr = minimumDate ? toDateStr(minimumDate) : null;
  const maxStr = maximumDate ? toDateStr(maximumDate) : null;
  const valueStr = toDateStr(value);
  const today = new Date();
  const todayStr = toDateStr(today);

  const cells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) result.push(null);
    for (let day = 1; day <= daysInMonth; day++) result.push(new Date(viewYear, viewMonth, day));
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const todayDisabled = (!!minStr && todayStr < minStr) || (!!maxStr && todayStr > maxStr);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.card, Shadow.md]} activeOpacity={1}>
          <View style={styles.banner}>
            <Text style={styles.bannerLabel}>Pilih Tanggal</Text>
            <Text style={styles.bannerDate}>
              {HARI_PANJANG[value.getDay()]}, {value.getDate()} {BULAN_PANJANG[value.getMonth()]} {value.getFullYear()}
            </Text>
          </View>

          <View style={styles.body}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.navBtn} onPress={goPrevMonth}>
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{BULAN_PANJANG[viewMonth]} {viewYear}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={goNextMonth}>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekHeaderRow}>
              {HARI_SINGKAT.map(h => (
                <Text key={h} style={styles.weekHeaderText}>{h}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={i} style={styles.cell} />;
                const ds = toDateStr(d);
                const disabled = (!!minStr && ds < minStr) || (!!maxStr && ds > maxStr);
                const selected = ds === valueStr;
                const isToday  = ds === todayStr;
                return (
                  <View key={i} style={styles.cell}>
                    <TouchableOpacity
                      style={[
                        styles.dayBtn,
                        selected && styles.dayBtnSelected,
                        isToday && !selected && styles.dayBtnToday,
                      ]}
                      activeOpacity={0.7}
                      disabled={disabled}
                      onPress={() => onSelect(d)}
                    >
                      <Text style={[
                        styles.dayText,
                        disabled && styles.dayTextDisabled,
                        selected && styles.dayTextSelected,
                        isToday && !selected && styles.dayTextToday,
                      ]}>
                        {d.getDate()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.footerBtn}
                activeOpacity={0.7}
                disabled={todayDisabled}
                onPress={() => onSelect(today)}
              >
                <Text style={[styles.footerBtnText, todayDisabled && styles.dayTextDisabled]}>Hari Ini</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerBtn} activeOpacity={0.7} onPress={onClose}>
                <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const getStyles = (colors: ColorPalette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  card: { backgroundColor: colors.white, borderRadius: Radius.xl, width: '100%', overflow: 'hidden' },
  banner: { backgroundColor: colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  bannerLabel: { fontSize: FontSize.xs, fontFamily: 'Poppins_600SemiBold', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5, marginBottom: 4 },
  bannerDate: { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: '#fff' },
  body: { padding: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerTitle: { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: colors.textPrimary },
  navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  weekHeaderRow: { flexDirection: 'row' },
  weekHeaderText: { width: `${100 / 7}%`, textAlign: 'center', fontSize: FontSize.xs, fontFamily: 'Poppins_600SemiBold', color: colors.textHint, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayBtn: { width: '82%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayBtnSelected: { backgroundColor: colors.primary },
  dayBtnToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { fontSize: FontSize.sm, fontFamily: 'Poppins_500Medium', color: colors.textPrimary },
  dayTextDisabled: { color: colors.textHint, opacity: 0.5 },
  dayTextSelected: { color: '#fff', fontFamily: 'Poppins_700Bold' },
  dayTextToday: { color: colors.primary, fontFamily: 'Poppins_700Bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.background },
  footerBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.md },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: 'Poppins_700Bold', color: colors.primary },
});
