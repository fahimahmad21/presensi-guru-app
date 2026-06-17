import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Animated,
  FlatList,
  SafeAreaView,
} from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';

const WIN_H = Dimensions.get("window").height;
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ColorPalette } from "../constants/Colors";
import { FontSize, Radius, Shadow } from "../constants/Theme";
import AlertModal from "./AlertModal";
import { AbsentInfo, CountryItem } from "../types";
import { getAbsentInfo } from "../services/absentService";
import { getCountries, updateProfile, updatePassword } from "../services/authService";
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
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
                <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                <Ionicons name="lock-closed-outline" size={18} color={colors.textHint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Masukkan kata sandi lama"
                  placeholderTextColor={colors.textHint}
                  value={passLama}
                  onChangeText={t => { setPassLama(t); setError(''); }}
                  secureTextEntry={!showLama}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowLama(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showLama ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textHint} />
                </TouchableOpacity>
              </View>

              {/* Kata Sandi Baru */}
              <Text style={styles.fieldLabel}>KATA SANDI BARU</Text>
              <View style={[styles.inputWrap, error && !passBaru && styles.inputError]}>
                <Ionicons name="key-outline" size={18} color={colors.textHint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Minimal 6 karakter"
                  placeholderTextColor={colors.textHint}
                  value={passBaru}
                  onChangeText={t => { setPassBaru(t); setError(''); }}
                  secureTextEntry={!showBaru}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowBaru(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showBaru ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textHint} />
                </TouchableOpacity>
              </View>

              {/* Konfirmasi */}
              <Text style={styles.fieldLabel}>KONFIRMASI KATA SANDI BARU</Text>
              <View style={[styles.inputWrap, error && passKonfirmasi && passBaru !== passKonfirmasi && styles.inputError]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.textHint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ulangi kata sandi baru"
                  placeholderTextColor={colors.textHint}
                  value={passKonfirmasi}
                  onChangeText={t => { setPassKonfirmasi(t); setError(''); }}
                  secureTextEntry={!showKonfirmasi}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowKonfirmasi(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showKonfirmasi ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textHint} />
                </TouchableOpacity>
              </View>

              {/* Error */}
              {!!error && (
                <View style={styles.errorWrap}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
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

// ─── FloatInput ──────────────────────────────────────────────────────────────

function FloatInput({
  label, value, onChangeText, onClear, icon,
  keyboardType, autoCapitalize, multiline = false,
  editable = true, onPress, prefix,
}: {
  label: string; value: string;
  onChangeText?: (t: string) => void;
  onClear?: () => void;
  icon: string;
  keyboardType?: any; autoCapitalize?: any;
  multiline?: boolean; editable?: boolean;
  onPress?: () => void; prefix?: string;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const active = focused || !!value;

  useEffect(() => {
    Animated.timing(anim, { toValue: active ? 1 : 0, duration: 150, useNativeDriver: false }).start();
  }, [active]);

  const H    = multiline ? 106 : 62;
  const BTOP = 12;
  const LL   = 44; // label left: 14 (pad) + 18 (icon) + 8 (gap) + 4

  const inactiveTop = multiline ? BTOP + 10 : BTOP + (H - BTOP) / 2 - 8;
  const labelTop   = anim.interpolate({ inputRange: [0, 1], outputRange: [inactiveTop, 3] });
  const labelSize  = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 11] });
  const labelColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textHint, focused ? colors.primary : colors.textTertiary],
  });

  const hasClear = !!value && !!onClear;

  const inner = (
    <View style={{ height: H, marginBottom: 20 }}>
      {/* Border frame */}
      <View style={{
        position: 'absolute', top: BTOP, left: 0, right: 0, bottom: 0,
        borderWidth: focused ? 2 : 1.5,
        borderColor: focused ? colors.primary : colors.border,
        borderRadius: Radius.md,
        backgroundColor: colors.background,
      }} />
      {/* Floating label */}
      <Animated.Text style={{
        position: 'absolute', left: LL, top: labelTop,
        fontSize: labelSize, color: labelColor,
        fontFamily: 'Poppins_400Regular',
        backgroundColor: colors.background,
        paddingHorizontal: 3, lineHeight: 16, zIndex: 1,
      }}>
        {label}
      </Animated.Text>
      {/* Content row */}
      <View style={{
        position: 'absolute', top: BTOP, left: 0, right: 0, bottom: 0,
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        paddingHorizontal: 14,
        paddingTop: multiline ? 12 : 0,
      }}>
        <Ionicons
          name={icon as any} size={18}
          color={focused ? colors.primary : colors.textHint}
          style={{ marginRight: 8, marginTop: multiline ? 2 : 0 }}
        />
        {prefix ? (
          <View style={{ paddingHorizontal: 7, paddingVertical: 3, backgroundColor: colors.border, borderRadius: 5, marginRight: 8 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: colors.textSecondary }}>{prefix}</Text>
          </View>
        ) : null}
        {editable ? (
          <TextInput
            style={{
              flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular',
              color: colors.textPrimary,
              textAlignVertical: multiline ? 'top' : 'center',
              alignSelf: multiline ? 'stretch' : 'center',
            }}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            placeholder=""
            placeholderTextColor="transparent"
          />
        ) : (
          <Text style={{
            flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular',
            color: value ? colors.textPrimary : 'transparent',
          }} numberOfLines={1}>
            {value || ' '}
          </Text>
        )}
        {hasClear ? (
          <TouchableOpacity onPress={onClear} style={{ padding: 6 }} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={colors.textHint} />
          </TouchableOpacity>
        ) : (!editable ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textHint} />
        ) : null)}
      </View>
    </View>
  );

  if (!editable && onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{inner}</TouchableOpacity>;
  }
  return inner;
}

// ─── CountryPickerModal ───────────────────────────────────────────────────────

function CountryPickerModal({ visible, onClose, countries, selectedId, onSelect }: {
  visible: boolean; onClose: () => void;
  countries: CountryItem[]; selectedId: number | null;
  onSelect: (c: CountryItem) => void;
}) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');

  useEffect(() => { if (!visible) setSearch(''); }, [visible]);

  const filtered = useMemo(() => {
    if (!search.trim()) return countries;
    const q = search.toLowerCase();
    return countries.filter(c =>
      (typeof c.name === 'string' && c.name.toLowerCase().includes(q)) ||
      (typeof c.phone === 'string' && c.phone.includes(q)),
    );
  }, [countries, search]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: colors.border,
          backgroundColor: colors.white,
        }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 12 }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: colors.textPrimary }}>
            Pilih Negara
          </Text>
        </View>
        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          margin: 12, paddingHorizontal: 14, paddingVertical: 10,
          backgroundColor: colors.white, borderRadius: Radius.md,
          borderWidth: 1.5, borderColor: colors.border,
        }}>
          <Ionicons name="search-outline" size={18} color={colors.textHint} />
          <TextInput
            style={{ flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: colors.textPrimary }}
            placeholder="Cari negara atau kode telepon..."
            placeholderTextColor={colors.textHint}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textHint} />
            </TouchableOpacity>
          )}
        </View>
        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: colors.background, marginLeft: 16 }} />
          )}
          renderItem={({ item: c }) => {
            const sel = c.id === selectedId;
            return (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 14,
                  backgroundColor: sel ? colors.primaryXLight : colors.white,
                }}
                onPress={() => { onSelect(c); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={{
                  flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular',
                  color: sel ? colors.primary : colors.textPrimary,
                }}>
                  {c.name}
                </Text>
                {c.phone ? (
                  <Text style={{ fontSize: FontSize.xs, fontFamily: 'Poppins_500Medium', color: colors.textTertiary, marginRight: sel ? 8 : 0 }}>
                    +{c.phone}
                  </Text>
                ) : null}
                {sel && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', padding: 32, fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: colors.textHint }}>
              Tidak ditemukan
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Edit Profil sheet ───────────────────────────────────────────────────────

interface EditProfilProps {
  visible:    boolean;
  onClose:    () => void;
  onSuccess:  () => void;
  countries:  CountryItem[];
}

function EditProfilSheet({ visible, onClose, onSuccess, countries }: EditProfilProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();

  const [nama,              setNama]              = useState('');
  const [email,             setEmail]             = useState('');
  const [telepon,           setTelepon]           = useState('');
  const [gender,            setGender]            = useState('');
  const [place,             setPlace]             = useState('');
  const [birthdayDate,      setBirthdayDate]      = useState<Date | null>(null);
  const [address,           setAddress]           = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [showCountryModal,  setShowCountryModal]  = useState(false);
  const [showDatePicker,    setShowDatePicker]    = useState(false);
  const [loading,           setLoading]           = useState(false);
  const [alertErr,          setAlertErr]          = useState('');
  const [alertOk,           setAlertOk]           = useState(false);

  const selectedCountry = useMemo(
    () => countries.find(c => c.id === selectedCountryId) ?? null,
    [countries, selectedCountryId],
  );

  const birthdayDisplay = useMemo(() =>
    birthdayDate
      ? birthdayDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
    [birthdayDate],
  );

  const birthdayApi = useMemo(() =>
    birthdayDate
      ? `${birthdayDate.getFullYear()}-${String(birthdayDate.getMonth() + 1).padStart(2, '0')}-${String(birthdayDate.getDate()).padStart(2, '0')}`
      : '',
    [birthdayDate],
  );

  useEffect(() => {
    if (!visible) return;
    setNama(user?.name ?? '');
    setEmail(user?.email ?? '');
    setTelepon(user?.phone ? String(user.phone) : '');
    setGender(user?.gender ?? '');
    setPlace(user?.place ?? '');
    setBirthdayDate(user?.birthday ? new Date(user.birthday) : null);
    setAddress(user?.address ?? '');
    setSelectedCountryId(user?.country ?? null);
    setShowCountryModal(false);
    setShowDatePicker(false);
    setAlertErr('');
    setAlertOk(false);
    setLoading(false);
  }, [visible]);

  const handleSimpan = async () => {
    setAlertErr('');
    if (!nama.trim()) { setAlertErr('Nama lengkap wajib diisi.'); return; }
    setLoading(true);
    try {
      const cleaned = telepon.replace(/\D/g, '').replace(/^(62|0)/, '');
      const res = await updateProfile({
        name:     nama.trim()       || undefined,
        email:    email.trim()      || undefined,
        phone:    cleaned           || undefined,
        country:  selectedCountryId ?? undefined,
        gender:   gender            || undefined,
        place:    place.trim()      || undefined,
        birthday: birthdayApi       || undefined,
        address:  address.trim()    || undefined,
      });
      if ((res as any).data?.status === false) {
        setAlertErr((res as any).data?.message ?? 'Gagal memperbarui profil.'); return;
      }
      onSuccess();
      setAlertOk(true);
    } catch (e: any) {
      setAlertErr(e?.response?.data?.message ?? e?.message ?? 'Gagal memperbarui profil.');
    } finally {
      setLoading(false);
    }
  };

  const countryLabel = selectedCountry
    ? `${selectedCountry.phone ? `+${selectedCountry.phone}  ` : ''}${selectedCountry.name}`
    : '';

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: colors.border,
              backgroundColor: colors.white,
            }}>
              <TouchableOpacity onPress={onClose} style={{ padding: 4, marginRight: 12 }}>
                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: colors.textPrimary }}>
                Edit Profil
              </Text>
              <TouchableOpacity
                style={[styles.simpanBtn, { paddingVertical: 8, paddingHorizontal: 18, marginTop: 0 }, loading && styles.simpanBtnDisabled]}
                onPress={handleSimpan} disabled={loading} activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.simpanBtnText}>Simpan</Text>}
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FloatInput
                label="Nama Lengkap" value={nama} icon="person-outline"
                autoCapitalize="words"
                onChangeText={t => { setNama(t); setAlertErr(''); }}
                onClear={() => { setNama(''); setAlertErr(''); }}
              />
              <FloatInput
                label="Email" value={email} icon="mail-outline"
                keyboardType="email-address" autoCapitalize="none"
                onChangeText={t => { setEmail(t); setAlertErr(''); }}
                onClear={() => { setEmail(''); setAlertErr(''); }}
              />
              <FloatInput
                label="Negara / Kode Telepon" value={countryLabel} icon="globe-outline"
                editable={false}
                onPress={() => setShowCountryModal(true)}
                onClear={() => setSelectedCountryId(null)}
              />
              <FloatInput
                label="No. Telepon" value={telepon} icon="call-outline"
                keyboardType="number-pad"
                prefix={selectedCountry?.phone ? `+${selectedCountry.phone}` : undefined}
                onChangeText={t => { setTelepon(t.replace(/[^0-9]/g, '')); setAlertErr(''); }}
                onClear={() => { setTelepon(''); setAlertErr(''); }}
              />

              <Text style={[styles.fieldLabel, { marginBottom: 10 }]}>JENIS KELAMIN</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                  onPress={() => setGender('male')} activeOpacity={0.8}>
                  <Ionicons name="male-outline" size={16} color={gender === 'male' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.genderBtnText, gender === 'male' && styles.genderBtnTextActive]}>Laki-laki</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                  onPress={() => setGender('female')} activeOpacity={0.8}>
                  <Ionicons name="female-outline" size={16} color={gender === 'female' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.genderBtnText, gender === 'female' && styles.genderBtnTextActive]}>Perempuan</Text>
                </TouchableOpacity>
              </View>

              <FloatInput
                label="Tempat Lahir" value={place} icon="location-outline"
                onChangeText={t => { setPlace(t); setAlertErr(''); }}
                onClear={() => { setPlace(''); setAlertErr(''); }}
              />
              <FloatInput
                label="Tanggal Lahir" value={birthdayDisplay} icon="calendar-outline"
                editable={false}
                onPress={() => setShowDatePicker(true)}
                onClear={() => setBirthdayDate(null)}
              />
              <FloatInput
                label="Alamat" value={address} icon="home-outline"
                multiline
                onChangeText={t => { setAddress(t); setAlertErr(''); }}
                onClear={() => { setAddress(''); setAlertErr(''); }}
              />

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <CountryPickerModal
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        countries={countries}
        selectedId={selectedCountryId}
        onSelect={c => setSelectedCountryId(c.id)}
      />

      <AlertModal
        visible={alertOk}
        type="success"
        title="Profil Diperbarui"
        message="Data profil Anda berhasil disimpan."
        onClose={() => { setAlertOk(false); onClose(); }}
      />

      <AlertModal
        visible={!!alertErr}
        type="error"
        title="Gagal Menyimpan"
        message={alertErr}
        onClose={() => setAlertErr('')}
      />

      {showDatePicker && (
        <DateTimePicker
          value={birthdayDate ?? new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, date) => {
            setShowDatePicker(false);
            if (date) setBirthdayDate(date);
          }}
          maximumDate={new Date()}
        />
      )}
    </>
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
  { key: 'reminderHarian',  icon: 'alarm-outline',         label: 'Pengingat Absen Harian',   desc: 'Push notification pukul 06:30 (masuk) dan 15:00 (pulang) setiap hari' },
  { key: 'statusIzin',      icon: 'document-text-outline', label: 'Status Pengajuan Izin',     desc: 'Notifikasi saat izin disetujui atau ditolak' },
  { key: 'peringatanTelat', icon: 'time-outline',          label: 'Peringatan Terlambat',      desc: 'Notifikasi saat tercatat terlambat masuk' },
  { key: 'peringatanNoOut', icon: 'log-out-outline',       label: 'Pengingat Lupa Checkout',   desc: 'Notifikasi saat tidak ada catatan absen pulang' },
];

function PengaturanNotifikasiSheet({ visible, onClose }: PengaturanProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} />
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
                  <View style={[styles.settingIconWrap, { backgroundColor: settings[row.key] ? colors.primaryXLight : colors.background }]}>
                    <Ionicons name={row.icon} size={20} color={settings[row.key] ? colors.primary : colors.textHint} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>{row.label}</Text>
                    <Text style={styles.settingDesc}>{row.desc}</Text>
                  </View>
                  <Switch
                    value={settings[row.key]}
                    onValueChange={v => handleToggle(row.key, v)}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={settings[row.key] ? colors.primary : '#f4f3f4'}
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

function getKontakItems(colors: ColorPalette, isDark: boolean): {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  nilai: string;
  color: string;
  bg: string;
  scheme: string;
}[] {
  return [
    { icon: 'logo-whatsapp', label: 'WhatsApp Admin',  nilai: '0812-0000-0000', color: isDark ? '#66BB6A' : '#25D366', bg: isDark ? '#1B3320' : '#E8F8EE', scheme: 'whatsapp://send?phone=628120000000' },
    { icon: 'call-outline',  label: 'Telepon Sekolah', nilai: '(021) 000-0000',  color: colors.primary, bg: colors.primaryXLight, scheme: 'tel:0210000000' },
    { icon: 'mail-outline',  label: 'Email Admin',     nilai: 'admin@bintangjuara.sch.id', color: colors.accentDark, bg: colors.accentLight, scheme: 'mailto:admin@bintangjuara.sch.id' },
  ];
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
          color={colors.textHint}
        />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </TouchableOpacity>
  );
}

function BantuanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const KONTAK_ITEMS = useMemo(() => getKontakItems(colors, isDark), [colors, isDark]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.bantuanSheet}>
          <View style={styles.handle} />

          <View style={styles.topBar}>
            <Text style={styles.topTitle}>Bantuan</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* FAQ */}
            <View style={styles.bantuanSection}>
              <View style={styles.bantuanSectionHeader}>
                <Ionicons name="help-circle" size={18} color={colors.primary} />
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
                <Ionicons name="call" size={18} color={colors.primary} />
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
                    <Ionicons name="open-outline" size={15} color={colors.textHint} />
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
  const { user, updateFoto, refreshProfile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [absentInfo,      setAbsentInfo]      = useState<AbsentInfo | null>(null);
  const [countries,       setCountries]       = useState<CountryItem[]>([]);
  const [infoLoading,     setInfoLoading]     = useState(false);
  const [uploadLoading,   setUploadLoading]   = useState(false);
  const [showUbahSandi,       setShowUbahSandi]       = useState(false);
  const [showPengaturanNotif, setShowPengaturanNotif] = useState(false);
  const [showBantuan,         setShowBantuan]         = useState(false);
  const [showEditProfil,      setShowEditProfil]      = useState(false);
  const [alertKonfirmasi, setAlertKonfirmasi] = useState(false);
  const [alertFoto,       setAlertFoto]       = useState({ visible: false, type: 'success' as 'success' | 'error', msg: '' });
  const [alertSandi,      setAlertSandi]      = useState(false);
  const [alertEditOk,     setAlertEditOk]     = useState(false);

  const firstName = user?.name?.split(' ')[0] ?? 'G';

  useEffect(() => {
    if (!visible) return;
    setInfoLoading(true);
    Promise.all([
      getAbsentInfo().then(r => r.data.data).catch(() => null),
      countries.length === 0
        ? getCountries().then(r => r.data.data ?? []).catch(() => [])
        : Promise.resolve(countries),
    ]).then(([info, ctrs]) => {
      setAbsentInfo(info as AbsentInfo | null);
      if ((ctrs as CountryItem[]).length > 0) setCountries(ctrs as CountryItem[]);
      setInfoLoading(false);
    });
  }, [visible]);

  const dialCode = useMemo(() => {
    if (!user?.country || countries.length === 0) return '';
    const found = countries.find(c => c.id === user.country);
    return found ? `+${found.phone}` : '';
  }, [user?.country, countries]);

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
                <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                  <Ionicons name="image-outline" size={15} color={colors.primary} />
                  <Text style={styles.gantiBtnText}>Ganti Foto Profil</Text>
                </TouchableOpacity>
              </View>

              {/* Informasi Akun */}
              <View style={[styles.infoCard, Shadow.sm]}>
                <View style={styles.infoCardTitleRow}>
                  <Text style={styles.infoCardTitle}>Informasi Akun</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {infoLoading && <ActivityIndicator size="small" color={colors.primary} />}
                    <TouchableOpacity style={styles.editProfilBtn} onPress={() => setShowEditProfil(true)} activeOpacity={0.7}>
                      <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                      <Text style={styles.editProfilBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name="mail-outline" size={18} color={colors.primary} />
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
                      <Ionicons name={row.icon} size={18} color={colors.primary} />
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
                    <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>Ubah Kata Sandi</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textHint} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => setShowPengaturanNotif(true)}
                >
                  <View style={styles.menuIconWrap}>
                    <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>Pengaturan Notifikasi</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textHint} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuRow}
                  activeOpacity={0.7}
                  onPress={() => setShowBantuan(true)}
                >
                  <View style={styles.menuIconWrap}>
                    <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>Bantuan</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textHint} />
                </TouchableOpacity>

                <View style={[styles.menuRow, styles.menuRowLast]}>
                  <View style={styles.menuIconWrap}>
                    <Ionicons name={isDark ? 'moon' : 'moon-outline'} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>Mode Gelap</Text>
                  <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={isDark ? colors.primary : '#f4f3f4'}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Logout footer */}
            <View style={styles.logoutFooter}>
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => setAlertKonfirmasi(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="log-out-outline" size={22} color={colors.error} />
                <Text style={styles.logoutText}>Keluar dari Akun</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profil sheet */}
      <EditProfilSheet
        visible={showEditProfil}
        onClose={() => setShowEditProfil(false)}
        onSuccess={() => { refreshProfile(); setAlertEditOk(true); }}
        countries={countries}
      />

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
        visible={alertEditOk}
        type="success"
        title="Profil Diperbarui"
        message="Data profil Anda berhasil disimpan."
        onClose={() => setAlertEditOk(false)}
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

const getStyles = (colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: WIN_H * 0.88,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Shadow.md,
  },
  sandiSheet: {
    height: WIN_H * 0.62,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Shadow.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  topTitle: { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: colors.textPrimary },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  // Ubah Kata Sandi form
  sandiBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  fieldLabel: {
    fontSize: FontSize.xs - 1, fontFamily: 'Poppins_600SemiBold',
    color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, marginBottom: 16, height: 52,
  },
  inputError:  { borderColor: colors.error },
  inputIcon:   { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular',
    color: colors.textPrimary,
  },
  eyeBtn: { padding: 4 },
  errorWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.errorLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: colors.error },
  simpanBtn: {
    backgroundColor: colors.primary,
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    ...Shadow.md,
  },
  bantuanSection:       { paddingHorizontal: 16, marginBottom: 4, marginTop: 12 },
  bantuanSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  bantuanSectionTitle:  { fontSize: FontSize.sm, fontFamily: 'Poppins_700Bold', color: colors.textPrimary },
  bantuanCard:          { backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden' },
  faqItem:              { paddingVertical: 14, paddingHorizontal: 16 },
  faqHeader:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ:                 { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: colors.textPrimary },
  faqA:                 { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: colors.textSecondary, lineHeight: 20, marginTop: 8 },
  faqDivider:           { borderBottomWidth: 1, borderBottomColor: colors.background },
  kontakRow:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.background },
  kontakRowLast:        { borderBottomWidth: 0 },
  kontakIcon:           { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kontakLabel:          { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: colors.textTertiary },
  kontakNilai:          { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold' },
  appInfoWrap:          { alignItems: 'center', paddingVertical: 24, gap: 4 },
  appInfoName:          { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: colors.textPrimary },
  appInfoVer:           { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: colors.textTertiary },
  appInfoPowered:       { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_400Regular', color: colors.textHint },

  // Pengaturan Notifikasi rows
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  settingRowLast:  { borderBottomWidth: 0 },
  settingIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingText:     { flex: 1 },
  settingLabel:    { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: colors.textPrimary },
  settingDesc:     { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_400Regular', color: colors.textTertiary, marginTop: 2 },

  // Profile top
  profileTop: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatarWrap:   { position: 'relative', marginBottom: 14 },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.primaryLight,
  },
  avatarLoading: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter:  { fontSize: 40, fontFamily: 'Poppins_700Bold', color: '#fff' },
  cameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  profileNama:  { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: colors.textPrimary, textAlign: 'center' },
  profileEmail: { fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: colors.textSecondary, marginBottom: 12 },
  gantiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryXLight,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  gantiBtnText: { fontSize: FontSize.xs, fontFamily: 'Poppins_600SemiBold', color: colors.primary },

  // Edit Profil button & gender toggle
  editProfilBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: colors.primary,
  },
  editProfilBtnText: { fontSize: FontSize.xs, fontFamily: 'Poppins_600SemiBold', color: colors.primary },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
  },
  genderBtnActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  genderBtnText:      { fontSize: FontSize.sm, fontFamily: 'Poppins_500Medium', color: colors.textSecondary },
  genderBtnTextActive: { color: '#fff', fontFamily: 'Poppins_600SemiBold' },

  // Info card
  infoCard: { backgroundColor: colors.white, borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16 },
  infoCardTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  infoCardTitle:  { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: colors.textPrimary },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.background },
  infoRowLast:    { borderBottomWidth: 0 },
  infoIconWrap:   { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryXLight, alignItems: 'center', justifyContent: 'center' },
  infoText:       { flex: 1 },
  infoLabel:      { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_400Regular', color: colors.textTertiary },
  infoValue:      { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: colors.textPrimary },
  infoValueEmpty: { color: colors.textHint, fontFamily: 'Poppins_400Regular' },

  // Menu card
  menuCard: { backgroundColor: colors.white, borderRadius: 16, marginHorizontal: 16, marginBottom: 4, overflow: 'hidden' },
  menuRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.background },
  menuRowLast: { borderBottomWidth: 0 },
  menuIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  menuLabel:    { flex: 1, fontSize: FontSize.sm, fontFamily: 'Poppins_500Medium', color: colors.textPrimary },

  // Logout
  logoutFooter: { borderTopWidth: 1, borderTopColor: colors.background, paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 28, backgroundColor: colors.white },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 15, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: colors.errorLight,
    backgroundColor: colors.errorLight,
  },
  logoutText: { fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold', color: colors.error },
});
