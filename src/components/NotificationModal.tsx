import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorPalette } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import { FontSize, Shadow } from '../constants/Theme';
import { buildNotifications, getReadIds, saveReadIds, NotifItem } from '../services/NotificationService';
import { useNotifBadge } from '../context/NotifBadgeContext';

function getTipeCfg(colors: ColorPalette, isDark: boolean): Record<NotifItem['tipe'], { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> {
  return {
    absensi: { color: colors.primary,    bg: colors.primaryXLight, icon: 'time-outline'          },
    izin:    { color: colors.accentDark, bg: colors.accentLight,   icon: 'document-text-outline' },
    sistem:  { color: isDark ? '#CE93D8' : '#6A1B9A', bg: isDark ? '#2A1B3A' : '#F3E5F5', icon: 'settings-outline' },
  };
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationModal({ visible, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const TIPE_CFG = useMemo(() => getTipeCfg(colors, isDark), [colors, isDark]);
  const { syncBadge } = useNotifBadge();
  const [notifs,  setNotifs]  = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    buildNotifications()
      .then(list => { setNotifs(list); syncBadge(list.filter(n => !n.dibaca).length); })
      .catch(() => setError('Gagal memuat notifikasi'))
      .finally(() => setLoading(false));
  }, [visible]);

  const tandaiSatu = async (id: string) => {
    const updated = notifs.map(n => n.id === id ? { ...n, dibaca: true } : n);
    setNotifs(updated);
    syncBadge(updated.filter(n => !n.dibaca).length);
    const readIds = await getReadIds();
    readIds.add(id);
    await saveReadIds(readIds);
  };

  const tandaiSemuaDibaca = async () => {
    const updated = notifs.map(n => ({ ...n, dibaca: true }));
    setNotifs(updated);
    syncBadge(0);
    const readIds = await getReadIds();
    notifs.forEach(n => readIds.add(n.id));
    await saveReadIds(readIds);
  };

  const belumDibaca = notifs.filter(n => !n.dibaca).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Notifikasi</Text>
              {belumDibaca > 0 && (
                <Text style={styles.headerSub}>{belumDibaca} belum dibaca</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              {belumDibaca > 0 && (
                <TouchableOpacity onPress={tandaiSemuaDibaca} style={styles.tandaiBtn}>
                  <Text style={styles.tandaiBtnText}>Tandai dibaca</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.centerText}>Memuat notifikasi...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerBox}>
                <Ionicons name="cloud-offline-outline" size={48} color={colors.textHint} />
                <Text style={styles.centerText}>{error}</Text>
              </View>
            ) : notifs.length === 0 ? (
              <View style={styles.centerBox}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.textHint} />
                <Text style={styles.centerText}>Tidak ada notifikasi</Text>
              </View>
            ) : (
              notifs.map(n => {
                const cfg = TIPE_CFG[n.tipe];
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.item, !n.dibaca && styles.itemUnread]}
                    onPress={() => tandaiSatu(n.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                    </View>
                    <View style={styles.itemBody}>
                      <View style={styles.itemTop}>
                        <Text style={styles.itemJudul} numberOfLines={1}>{n.judul}</Text>
                        {!n.dibaca && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.itemPesan} numberOfLines={2}>{n.pesan}</Text>
                      <Text style={styles.itemWaktu}>{n.waktu}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ColorPalette) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '85%', ...Shadow.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  headerTitle:   { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: colors.textPrimary },
  headerSub:     { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: colors.primary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tandaiBtn: { backgroundColor: colors.primaryXLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tandaiBtnText: { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_600SemiBold', color: colors.primary },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: 16 },
  centerBox:  { alignItems: 'center', paddingVertical: 48, gap: 12 },
  centerText: { fontSize: FontSize.md, fontFamily: 'Poppins_500Medium', color: colors.textHint },

  item: {
    flexDirection: 'row', gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  itemUnread: {
    backgroundColor: colors.primaryXLight,
    marginHorizontal: -16, paddingHorizontal: 16,
    borderRadius: 12, borderBottomColor: 'transparent', marginBottom: 2,
  },
  itemIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemBody:  { flex: 1 },
  itemTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  itemJudul: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: colors.textPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 6, flexShrink: 0 },
  itemPesan: { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  itemWaktu: { fontSize: FontSize.xs - 2, fontFamily: 'Poppins_400Regular', color: colors.textHint },
});
