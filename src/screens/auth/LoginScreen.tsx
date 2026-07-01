import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../types';
import { ColorPalette } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, Radius, Shadow, Spacing } from '../../constants/Theme';
import AlertModal from '../../components/AlertModal';
import { getSavedAccounts, removeSavedAccount, SavedAccount } from '../../services/accountService';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { login, loginWithSavedAccount } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, msg: '' });

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAkunDropdown, setShowAkunDropdown] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts);
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setAlert({ visible: true, msg: 'Username dan kata sandi wajib diisi.' });
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch {
      setAlert({ visible: true, msg: 'Email atau kata sandi salah. Silakan coba lagi.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePilihAkun = async (account: SavedAccount) => {
    setShowAkunDropdown(false);
    setUsername(account.username);
    setLoading(true);
    try {
      await loginWithSavedAccount(account);
    } catch {
      setAlert({ visible: true, msg: `Sesi "${account.name}" sudah berakhir. Silakan masukkan kata sandi untuk masuk kembali.` });
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleHapusAkun = async (acc: SavedAccount) => {
    await removeSavedAccount(acc.username);
    setSavedAccounts(prev => prev.filter(a => a.username !== acc.username));
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── HEADER ── */}
        <LinearGradient colors={['#0D47A1', '#1565C0', '#90CAF9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          {/*
           * Logo ditempatkan di kotak PUTIH → background putih logo
           * menyatu dengan kotak, efek terlihat transparan.
           * Ganti logo.png dengan versi transparan (remove.bg) untuk hasil terbaik.
           */}
          <View style={styles.logoBox}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.schoolSub}>Sistem Presensi Guru</Text>
          <View style={styles.headerCurve} />
        </LinearGradient>

        {/* ── FORM ── */}
        <View style={styles.body}>
          <Text style={styles.greeting}>Selamat Datang 👋</Text>
          <Text style={styles.greetingSub}>Masuk untuk melanjutkan.</Text>

          <Text style={styles.label}>USERNAME / EMAIL / NO. HP</Text>
          <View style={styles.inputGroup}>
            <View style={styles.inputWrap}>
              <Ionicons name="person" size={16} color="#9E9E9E" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                placeholder="Username atau Email"
                placeholderTextColor={colors.textHint}
                value={username}
                onChangeText={t => { setUsername(t); setShowAkunDropdown(false); }}
                onFocus={() => { if (!username && savedAccounts.length > 0) setShowAkunDropdown(true); }}
                onBlur={() => setTimeout(() => setShowAkunDropdown(false), 150)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {showAkunDropdown && (
              <View style={[styles.akunDropdown, Shadow.md]}>
                {savedAccounts.map(acc => (
                  <View key={acc.username} style={styles.akunItem}>
                    <TouchableOpacity style={styles.akunItemMain} onPress={() => handlePilihAkun(acc)} activeOpacity={0.7}>
                      <View style={styles.akunAvatar}>
                        <Text style={styles.akunAvatarText}>{acc.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.akunNama} numberOfLines={1}>{acc.name}</Text>
                        <Text style={styles.akunUsername} numberOfLines={1}>{acc.username}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleHapusAkun(acc)} style={styles.akunHapus} hitSlop={8}>
                      <Text style={styles.akunHapusText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.label}>KATA SANDI</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed" size={16} color="#9E9E9E" style={{ marginRight: 10 }} />
            <TextInput
              ref={passwordRef}
              style={[styles.input, { flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textHint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye' : 'eye-off'} size={18} color="#9E9E9E" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotRow}>
            <Text style={styles.forgotText}>Lupa kata sandi?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginBtnGrad}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>🔑  Masuk</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footer}>v1.0.0 · <Text style={styles.footerBrand}>Sekolah Islam Bintang Juara</Text> · 2026</Text>
        </View>
      </ScrollView>

      <AlertModal
        visible={alert.visible}
        type="warning"
        title="Perhatian"
        message={alert.msg}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ColorPalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  header: { paddingTop: 52, paddingBottom: 60, paddingHorizontal: 20, alignItems: 'center', position: 'relative' },
  headerCurve: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 36, backgroundColor: colors.white, borderTopLeftRadius: 200, borderTopRightRadius: 200 },
  logoBox: { width: 90, height: 90, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadow.md },
  logoImage: { width: 78, height: 78 },
  schoolSub: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginTop: 4 },

  body: { padding: Spacing.md, paddingTop: Spacing.lg },
  greeting: { fontSize: FontSize.xxl, fontFamily: 'Poppins_700Bold', color: colors.textPrimary },
  greetingSub: { fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: colors.textTertiary, marginTop: 4, marginBottom: Spacing.lg },

  label: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: Radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, marginBottom: 14, height: 52 },
  input: { flex: 1, fontSize: FontSize.md, fontFamily: 'Poppins_400Regular', color: colors.textPrimary },
  eyeBtn: { padding: 4 },

  inputGroup: { position: 'relative', zIndex: 10 },
  akunDropdown: {
    position: 'absolute', top: 56, left: 0, right: 0, zIndex: 20,
    backgroundColor: colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  akunItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.background },
  akunItemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  akunAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryXLight, alignItems: 'center', justifyContent: 'center' },
  akunAvatarText: { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: colors.primary },
  akunNama: { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: colors.textPrimary },
  akunUsername: { fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', color: colors.textTertiary, marginTop: 1 },
  akunHapus: { paddingHorizontal: 14, paddingVertical: 10 },
  akunHapusText: { fontSize: FontSize.sm, color: colors.textHint },

  forgotRow: { alignItems: 'flex-end', marginBottom: Spacing.lg },
  forgotText: { fontSize: FontSize.sm, fontFamily: 'Poppins_500Medium', color: colors.primary },

  loginBtn: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md },
  loginBtnGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { color: '#fff', fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold' },

  footer: { textAlign: 'center', fontSize: FontSize.xs, color: colors.textHint, fontFamily: 'Poppins_400Regular', marginTop: Spacing.sm },
  footerBrand: { color: colors.primary, fontFamily: 'Poppins_600SemiBold' },
});
