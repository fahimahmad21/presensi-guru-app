import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";

const WIN_H = Dimensions.get("window").height;
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import Colors from "../constants/Colors";
import { FontSize, Radius, Shadow } from "../constants/Theme";
import AlertModal from "./AlertModal";
import { AbsentInfo } from "../types";
import { getAbsentInfo } from "../services/absentService";
import { getCountries, updatePassword } from "../services/authService";
import {
  NotifSettings,
  getNotifSettings,
  saveNotifSettings,
  jadwalkanReminderHarian,
  cancelReminderHarian,
} from "../services/NotificationService";

// ─── Ubah Kata Sandi sheet ────────────────────────────────────────────────────

interface UbahSandiProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function UbahKataSandiSheet({ visible, onClose, onSuccess }: UbahSandiProps) {
  const [passLama,       setPassLama]       = useState('');
  const [passBaru,       setPassBaru]       = useState('');
  const [passKonfirmasi, setPassKonfirmasi] = useState('');
  const [showLama,       setShowLama]       = useState(false);
  const [showBaru,       setShowBaru]       = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');

  const reset = () => {
    setPassLama(''); setPassBaru(''); setPassKonfirmasi('');
    setShowLama(false); setShowBaru(false); setShowKonfirmasi(false);
    setError(''); setLoading(false);
  };

  useEffect(() => { if (!visible) reset(); }, [visible]);

  const handleSimpan = async () => {
    setError('');
    if (!passLama || !passBaru || !passKonfirmasi) {
      setError('Semua field wajib diisi.'); return;
    }
    if (passBaru.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.'); return;
    }
    if (passBaru !== passKonfirmasi) {
      setError('Konfirmasi kata sandi tidak cocok.'); return;
    }
    if (passBaru === passLama) {
      setError('Kata sandi baru tidak boleh sama dengan yang lama.'); return;
    }
    setLoading(true);
    try {
      const res = await updatePassword(passLama, passBaru, passKonfirmasi);
      if ((res as any).data?.status === false) {
        setError((res as any).data?.message ?? 'Gagal mengubah kata sandi.');
        return;
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Gagal mengubah kata sandi.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View style={styles.sandiSheet}>
            <View style={styles.handle} />

            <View style={styles.topBar}>
              <Text style={styles.topTitle}>Ubah Kata Sandi</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.sandiBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Kata Sandi Lama */}
              <Text style={styles.fieldLabel}>KATA SANDI LAMA</Text>
              <View style={[styles.inputWrap, error && !passLama && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textHint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Masukkan kata sandi lama"
                  placeholderTextColor={Colors.textHint}
                  value={passLama}
                  onChangeText={t => { setPassLama(t); setError(''); }}
                  secureTextEntry={!showLama}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowLama(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showLama ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textHint} />
                </TouchableOpacity>
              </View>

              {/* Kata Sandi Baru */}
              <Text style={styles.fieldLabel}>KATA SANDI BARU</Text>
              <View style={[styles.inputWrap, error && !passBaru && styles.inputError]}>
                <Ionicons name="key-outline" size={18} color={Colors.textHint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Minimal 6 karakter"
                  placeholderTextColor={Colors.textHint}
                  value={passBaru}
                  onChangeText={t => { setPassBaru(t); setError(''); }}
                  secureTextEntry={!showBaru}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowBaru(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showBaru ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textHint} />
                </TouchableOpacity>
              </View>

              {/* Konfirmasi */}
              <Text style={styles.fieldLabel}>KONFIRMASI KATA SANDI BARU</Text>
              <View style={[styles.inputWrap, error && passKonfirmasi && passBaru !== passKonfirmasi && styles.inputError]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.textHint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ulangi kata sandi baru"
                  placeholderTextColor={Colors.textHint}
                  value={passKonfirmasi}
                  onChangeText={t => { setPassKonfirmasi(t); setError(''); }}
                  secureTextEntry={!showKonfirmasi}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowKonfirmasi(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showKonfirmasi ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textHint} />
                </TouchableOpacity>
              </View>

              {/* Error */}
              {!!error && (
                <View style={styles.errorWrap}>
                  <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Simpan */}
              <TouchableOpacity
                style={[styles.simpanBtn, loading && styles.simpanBtnDisabled]}
                onPress={handleSimpan}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.simpanBtnText}>Simpan Perubahan</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Pengaturan Notifikasi sheet ─────────────────────────────────────────────

interface PengaturanProps {
  visible: boolean;
  onClose: () => void;
}

const NOTIF_ROWS: {
  key: keyof NotifSettings;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
}[] = [
  { key: 'reminderHarian',  icon: 'alarm-outline',         label: 'Pengingat Absen Harian',   desc: 'Push notification pukul 06:30 setiap hari kerja' },
  { key: 'statusIzin',      icon: 'document-text-outline', label: 'Status Pengajuan Izin',     desc: 'Notifikasi saat izin disetujui atau ditolak' },
  { key: 'peringatanTelat', icon: 'time-outline',          label: 'Peringatan Terlambat',      desc: 'Notifikasi saat tercatat terlambat masuk' },
  { key: 'peringatanNoOut', icon: 'log-out-outline',       label: 'Pengingat Lupa Checkout',   desc: 'Notifikasi saat tidak ada catatan absen pulang' },
];

function PengaturanNotifikasiSheet({ visible, onClose }: PengaturanProps) {
  const [settings, setSettings] = useState<NotifSettings>({
    reminderHarian: true, statusIzin: true, peringatanTelat: true, peringatanNoOut: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getNotifSettings().then(s => { setSettings(s); setLoading(false); });
  }, [visible]);

  const handleToggle = async (key: keyof NotifSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveNotifSettings(next);

    if (key === 'reminderHarian') {
      if (value) jadwalkanReminderHarian().catch(() => {});
      else       cancelReminderHarian().catch(() => {});
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sandiSheet, { height: WIN_H * 0.58 }]}>
          <View style={styles.handle} />

          <View style={styles.topBar}>
            <Text style={styles.topTitle}>Pengaturan Notifikasi</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {NOTIF_ROWS.map((row, idx) => (
                <View
                  key={row.key}
                  style={[styles.settingRow, idx === NOTIF_ROWS.length - 1 && styles.settingRowLast]}
                >
                  <View style={[styles.settingIconWrap, { backgroundColor: settings[row.key] ? Colors.primaryXLight : Colors.background }]}>
                    <Ionicons name={row.icon} size={20} color={settings[row.key] ? Colors.primary : Colors.textHint} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>{row.label}</Text>
                    <Text style={styles.settingDesc}>{row.desc}</Text>
                  </View>
                  <Switch
                    value={settings[row.key]}
                    onValueChange={v => handleToggle(row.key, v)}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={settings[row.key] ? Colors.primary : '#f4f3f4'}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Bantuan sheet ───────────────────────────────────────────────────────────

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Bagaimana cara melakukan absensi?',
    a: 'Buka tab Absensi, pastikan GPS aktif dan Anda berada dalam radius sekolah. Tekan tombol "Absen Masuk" saat datang dan "Absen Pulang" saat hendak pulang. Kamera akan aktif untuk mengambil foto verifikasi.',
  },
  {
    q: 'Apa arti kode status absensi?',
    a: 'CM = Cepat Masuk (tepat waktu), T = Terlambat, PT = Pulang Tepat, PC = Pulang Cepat (sebelum jam pulang), NO = Tidak ada catatan pulang.',
  },
  {
    q: 'Saya lupa absen pulang, apa yang harus dilakukan?',
    a: 'Segera hubungi admin TU sekolah untuk melakukan koreksi data absensi. Koreksi manual hanya dapat dilakukan oleh admin melalui portal MangoSpot.',
  },
  {
    q: 'Kenapa absensi saya tidak berhasil?',
    a: 'Periksa: (1) GPS aktif dan sinyal kuat, (2) Anda berada dalam radius sekolah yang ditetapkan, (3) Koneksi internet stabil, (4) Izin kamera dan lokasi sudah diberikan ke aplikasi.',
  },
  {
    q: 'Bagaimana cara mengajukan izin?',
    a: 'Buka tab Izin, tekan tombol "+ Ajukan Izin", pilih jenis izin, isi tanggal dan keterangan, lampirkan dokumen jika diperlukan, lalu kirim. Status izin akan diperbarui setelah diproses admin.',
  },
  {
    q: 'Bagaimana cara melihat laporan kehadiran?',
    a: 'Buka tab Laporan. Pilih tampilan Harian, Bulanan, atau Tahunan untuk melihat rekap kehadiran Anda. Tab Kustom memungkinkan filter rentang tanggal tertentu.',
  },
];

const KONTAK_ITEMS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  nilai: string;
  color: string;
  bg: string;
  scheme: string;
}[] = [
  { icon: 'logo-whatsapp', label: 'WhatsApp Admin',  nilai: '0812-0000-0000', color: '#25D366', bg: '#E8F8EE', scheme: 'whatsapp://send?phone=628120000000' },
  { icon: 'call-outline',  label: 'Telepon Sekolah', nilai: '(021) 000-0000',  color: Colors.primary, bg: Colors.primaryXLight, scheme: 'tel:0210000000' },
  { icon: 'mail-outline',  label: 'Email Admin',     nilai: 'admin@bintangjuara.sch.id', color: Colors.accentDark, bg: Colors.accentLight, scheme: 'mailto:admin@bintangjuara.sch.id' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.75}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textHint}
        />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </TouchableOpacity>
  );
}

function BantuanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.bantuanSheet}>
          <View style={styles.handle} />

          <View style={styles.topBar}>
            <Text style={styles.topTitle}>Bantuan</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* FAQ */}
            <View style={styles.bantuanSection}>
              <View style={styles.bantuanSectionHeader}>
                <Ionicons name="help-circle" size={18} color={Colors.primary} />
                <Text style={styles.bantuanSectionTitle}>Pertanyaan Umum</Text>
              </View>
              <View style={[styles.bantuanCard, Shadow.sm]}>
                {FAQ_ITEMS.map((item, idx) => (
                  <View key={idx} style={idx < FAQ_ITEMS.length - 1 && styles.faqDivider}>
                    <FaqItem q={item.q} a={item.a} />
                  </View>
                ))}
              </View>
            </View>

            {/* Kontak */}
            <View style={styles.bantuanSection}>
              <View style={styles.bantuanSectionHeader}>
                <Ionicons name="call" size={18} color={Colors.primary} />
                <Text style={styles.bantuanSectionTitle}>Hubungi Admin Sekolah</Text>
              </View>
              <View style={[styles.bantuanCard, Shadow.sm]}>
                {KONTAK_ITEMS.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.kontakRow, idx === KONTAK_ITEMS.length - 1 && styles.kontakRowLast]}
                    onPress={() => Linking.openURL(item.scheme).catch(() => {})}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.kontakIcon, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kontakLabel}>{item.label}</Text>
                      <Text style={[styles.kontakNilai, { color: item.color }]}>{item.nilai}</Text>
                    </View>
                    <Ionicons name="open-outline" size={15} color={Colors.textHint} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Info Aplikasi */}
            <View style={styles.appInfoWrap}>
              <Text style={styles.appInfoName}>Presensi Guru</Text>
              <Text style={styles.appInfoVer}>Versi 1.0.0</Text>
              <Text style={styles.appInfoPowered}>Powered by MangoSpot</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function ProfileModal({ visible, onClose, onLogout }: Props) {
  const { user, updateFoto } = useAuth();

  const [absentInfo,      setAbsentInfo]      = useState<AbsentInfo | null>(null);
  const [dialCode,        setDialCode]        = useState<string>('');
  const [infoLoading,     setInfoLoading]     = useState(false);
  const [uploadLoading,   setUploadLoading]   = useState(false);
  const [showUbahSandi,       setShowUbahSandi]       = useState(false);
  const [showPengaturanNotif, setShowPengaturanNotif] = useState(false);
  const [showBantuan,         setShowBantuan]         = useState(false);
  const [alertKonfirmasi, setAlertKonfirmasi] = useState(false);
  const [alertFoto,       setAlertFoto]       = useState({ visible: false, type: 'success' as 'success' | 'error', msg: '' });
  const [alertSandi,      setAlertSandi]      = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? 'G';

  useEffect(() => {
    if (!visible) return;
    setInfoLoading(true);
    Promise.all([
      getAbsentInfo().then(r => r.data.data).catch(() => null),
      user?.country
        ? getCountries()
            .then(r => {
              const found = (r.data.data ?? []).find(c => c.id === user.country);
              return found ? `+${found.phone}` : '';
            })
            .catch(() => '')
        : Promise.resolve(''),
    ]).then(([info, dc]) => {
      setAbsentInfo(info as AbsentInfo | null);
      setDialCode(dc as string);
      setInfoLoading(false);
    });
  }, [visible]);

  const phoneDisplay = useMemo(() => {
    if (!user?.phone) return '-';
    return dialCode ? `${dialCode} ${user.phone}` : String(user.phone);
  }, [user?.phone, dialCode]);

  const genderLabel = useMemo(() => {
    if (!user?.gender) return '-';
    if (user.gender === 'L') return 'Laki-laki';
    if (user.gender === 'P') return 'Perempuan';
    return user.gender;
  }, [user?.gender]);

  const ttlLabel = useMemo(() => {
    const parts: string[] = [];
    if (user?.place) parts.push(user.place);
    if (user?.birthday) {
      const d = new Date(user.birthday + 'T00:00:00');
      parts.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));
    }
    return parts.length > 0 ? parts.join(', ') : '-';
  }, [user?.place, user?.birthday]);

  const infoRows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'id-card-outline',     label: 'NIP',           value: user?.code || '-' },
    { icon: 'briefcase-outline',   label: 'Jabatan',       value: 'Guru' },
    { icon: 'business-outline',    label: 'Unit',          value: absentInfo?.name ? `${absentInfo.name} Bintang Juara` : '-' },
    { icon: 'call-outline',        label: 'Telepon',       value: phoneDisplay },
    { icon: 'male-female-outline', label: 'Jenis Kelamin', value: genderLabel },
    { icon: 'calendar-outline',    label: 'TTL',           value: ttlLabel },
    { icon: 'location-outline',    label: 'Alamat',        value: user?.address || '-' },
  ];

  const handlePilihFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setAlertFoto({ visible: true, type: 'error', msg: 'Izin akses galeri diperlukan untuk mengganti foto profil.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setUploadLoading(true);
      try {
        await updateFoto(result.assets[0].base64);
        setAlertFoto({ visible: true, type: 'success', msg: 'Foto profil berhasil diperbarui.' });
      } catch {
        setAlertFoto({ visible: true, type: 'error', msg: 'Gagal mengunggah foto. Coba lagi.' });
      } finally {
        setUploadLoading(false);
      }
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.topBar}>
              <Text style={styles.topTitle}>Profil Saya</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 12 }}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Foto & Nama */}
              <View style={styles.profileTop}>
                <View style={styles.avatarWrap}>
                  {uploadLoading ? (
                    <View style={[styles.avatarCircle, styles.avatarLoading]}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : user?.images ? (
                    <Image
                      source={{ uri: user.images.startsWith('data:') ? user.images : `data:image/jpeg;base64,${user.images}` }}
                      style={styles.avatarCircle}
                    />
                  ) : (
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarLetter}>{firstName[0]}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.cameraBtn} onPress={handlePilihFoto}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.profileNama}>{user?.name ?? '-'}</Text>
                <Text style={styles.profileEmail}>{user?.email || '-'}</Text>
                <TouchableOpacity style={styles.gantiBtn} onPress={handlePilihFoto}>
                  <Ionicons name="image-outline" size={15} color={Colors.primary} />
                  <Text style={styles.gantiBtnText}>Ganti Foto Profil</Text>
                </TouchableOpacity>
              </View>

              {/* Informasi Akun */}
              <View style={[styles.infoCard, Shadow.sm]}>
                <View style={styles.infoCardTitleRow}>
                  <Text style={styles.infoCardTitle}>Informasi Akun</Text>
                  {infoLoading && <ActivityIndicator size="small" color={Colors.primary} />}
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.infoText}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={[styles.infoValue, !user?.email && styles.infoValueEmpty]}>
                      {user?.email || '-'}
                    </Text>
                  </View>
                </View>

                {infoRows.map((row, idx) => (
                  <View key={row.label} style={[styles.infoRow, idx === infoRows.length - 1 && styles.infoRowLast]}>
                    <View style={styles.infoIconWrap}>
                      <Ionicons name={row.icon} size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.infoText}>
                      <Text style={styles.infoLabel}>{row.label}</Text>
                      <Text style={[styles.infoValue, row.value === '-' && styles.infoValueEmpty]}>
                        {row.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Menu */}
              <View style={[styles.menuCard, Shadow.sm]}>
                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => setShowUbahSandi(true)}
                >
                  <View style={styles.menuIconWrap}>
                    <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>Ubah Kata Sandi</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => setShowPengaturanNotif(true)}
                >
                  <View style={styles.menuIconWrap}>
                    <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>Pengaturan Notifikasi</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => setShowBantuan(true)}
                >
                  <View style={styles.menuIconWrap}>
                    <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>Bantuan</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textHint} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Logout footer */}
            <View style={styles.logoutFooter}>
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => setAlertKonfirmasi(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="log-out-outline" size={22} color={Colors.error} />
                <Text style={styles.logoutText}>Keluar dari Akun</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bantuan sheet */}
      <BantuanSheet
        visible={showBantuan}
        onClose={() => setShowBantuan(false)}
      />

      {/* Pengaturan Notifikasi sheet */}
      <PengaturanNotifikasiSheet
        visible={showPengaturanNotif}
        onClose={() => setShowPengaturanNotif(false)}
      />

      {/* Ubah Kata Sandi bottom sheet */}
      <UbahKataSandiSheet
        visible={showUbahSandi}
        onClose={() => setShowUbahSandi(false)}
        onSuccess={() => setAlertSandi(true)}
      />

      <AlertModal
        visible={alertSandi}
        type="success"
        title="Kata Sandi Diperbarui"
        message="Kata sandi Anda berhasil diubah. Gunakan kata sandi baru untuk login berikutnya."
        onClose={() => setAlertSandi(false)}
      />

      <AlertModal
        visible={alertKonfirmasi}
        type="warning"
        title="Keluar dari Akun?"
        message="Anda akan keluar dari aplikasi. Pastikan presensi hari ini sudah tercatat."
        buttons={[
          { text: 'Batal',  onPress: () => setAlertKonfirmasi(false), variant: 'secondary' },
          { text: 'Keluar', onPress: () => { setAlertKonfirmasi(false); onClose(); onLogout(); } },
        ]}
        onClose={() => setAlertKonfirmasi(false)}
      />

      <AlertModal
        visible={alertFoto.visible}
        type={alertFoto.type}
        title={alertFoto.type === 'success' ? 'Berhasil' : 'Gagal'}
        message={alertFoto.msg}
        onClose={() => setAlertFoto(a => ({ ...a, visible: false }))}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: WIN_H * 0.88,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Shadow.md,
  },
  sandiSheet: {
    height: WIN_H * 0.62,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Shadow.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.background,
  },
  topTitle: { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  // Ubah Kata Sandi form
  sandiBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  fieldLabel: {
    fontSize: FontSize.xs - 1, fontFamily: 'Poppins_600SemiBold',
    color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, marginBottom: 16, height: 52,
  },
  inputError:  { borderColor: Colors.error },
  inputIcon:   { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular',
    color: Colors.textPrimary,
  },
  eyeBtn: { padding: 4 },
  errorWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: Colors.error },
  simpanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  simpanBtnDisabled: { opacity: 0.6 },
  simpanBtnText: { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: '#fff' },

  // Bantuan
  bantuanSheet: {
    height: WIN_H * 0.88,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    ...Shadow.md,
  },
  bantuanSection:       { paddingHorizontal: 16, marginBottom: 4, marginTop: 12 },
  bantuanSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  bantuanSectionTitle:  { fontSize: FontSize.sm, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  bantuanCard:          { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  faqItem:              { paddingVertical: 14, paddingHorizontal: 16 },
  faqHeader:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ:                 { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  faqA:                 { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, lineHeight: 20, marginTop: 8 },
  faqDivider:           { borderBottomWidth: 1, borderBottomColor: Colors.background },
  kontakRow:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.background },
  kontakRowLast:        { borderBottomWidth: 0 },
  kontakIcon:           { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kontakLabel:          { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  kontakNilai:          { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold' },
  appInfoWrap:          { alignItems: 'center', paddingVertical: 24, gap: 4 },
  appInfoName:          { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  appInfoVer:           { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  appInfoPowered:       { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_400Regular', color: Colors.textHint },

  // Pengaturan Notifikasi rows
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.background,
  },
  settingRowLast:  { borderBottomWidth: 0 },
  settingIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingText:     { flex: 1 },
  settingLabel:    { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  settingDesc:     { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 2 },

  // Profile top
  profileTop: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatarWrap:   { position: 'relative', marginBottom: 14 },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: Colors.primaryLight,
  },
  avatarLoading: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter:  { fontSize: 40, fontFamily: 'Poppins_700Bold', color: '#fff' },
  cameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  profileNama:  { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary, textAlign: 'center' },
  profileEmail: { fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: Colors.textSecondary, marginBottom: 12 },
  gantiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryXLight,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  gantiBtnText: { fontSize: FontSize.xs, fontFamily: 'Poppins_600SemiBold', color: Colors.primary },

  // Info card
  infoCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16 },
  infoCardTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.background,
  },
  infoCardTitle:  { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.background },
  infoRowLast:    { borderBottomWidth: 0 },
  infoIconWrap:   { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryXLight, alignItems: 'center', justifyContent: 'center' },
  infoText:       { flex: 1 },
  infoLabel:      { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary },
  infoValue:      { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  infoValueEmpty: { color: Colors.textHint, fontFamily: 'Poppins_400Regular' },

  // Menu card
  menuCard: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 4, overflow: 'hidden' },
  menuRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.background },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  menuLabel:    { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_500Medium', color: Colors.textPrimary },

  // Logout
  logoutFooter: { borderTopWidth: 1, borderTopColor: Colors.background, paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 28, backgroundColor: '#fff' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 15, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.errorLight,
    backgroundColor: '#FFF5F5',
  },
  logoutText: { fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold', color: Colors.error },
});
