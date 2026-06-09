import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { FontSize, Shadow } from '../constants/Theme';
import { buildNotifications, getReadIds, saveReadIds, NotifItem } from '../services/NotificationService';

const TIPE_CFG: Record<NotifItem['tipe'], { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  absensi: { color: Colors.primary,    bg: Colors.primaryXLight, icon: 'time-outline'          },
  izin:    { color: Colors.accentDark, bg: Colors.accentLight,   icon: 'document-text-outline' },
  sistem:  { color: '#6A1B9A',         bg: '#F3E5F5',            icon: 'settings-outline'      },
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationModal({ visible, onClose }: Props) {
  const [notifs,  setNotifs]  = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    buildNotifications()
      .then(setNotifs)
      .catch(() => setError('Gagal memuat notifikasi'))
      .finally(() => setLoading(false));
  }, [visible]);

  const tandaiSatu = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, dibaca: true } : n));
    const readIds = await getReadIds();
    readIds.add(id);
    await saveReadIds(readIds);
  };

  const tandaiSemuaDibaca = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, dibaca: true })));
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
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={Colors.primary} size="large" />
                <Text style={styles.centerText}>Memuat notifikasi...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerBox}>
                <Ionicons name="cloud-offline-outline" size={48} color={Colors.textHint} />
                <Text style={styles.centerText}>{error}</Text>
              </View>
            ) : notifs.length === 0 ? (
              <View style={styles.centerBox}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors.textHint} />
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

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '85%', ...Shadow.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.background,
  },
  headerTitle:   { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  headerSub:     { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: Colors.primary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tandaiBtn: { backgroundColor: Colors.primaryXLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tandaiBtnText: { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: 16 },
  centerBox:  { alignItems: 'center', paddingVertical: 48, gap: 12 },
  centerText: { fontSize: FontSize.md, fontFamily: 'Poppins_500Medium', color: Colors.textHint },

  item: {
    flexDirection: 'row', gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.background,
  },
  itemUnread: {
    backgroundColor: Colors.primaryXLight,
    marginHorizontal: -16, paddingHorizontal: 16,
    borderRadius: 12, borderBottomColor: 'transparent', marginBottom: 2,
  },
  itemIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemBody:  { flex: 1 },
  itemTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  itemJudul: { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 6, flexShrink: 0 },
  itemPesan: { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  itemWaktu: { fontSize: FontSize.xs - 2, fontFamily: 'Poppins_400Regular', color: Colors.textHint },
});
