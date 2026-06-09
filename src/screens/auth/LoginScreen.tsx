import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../types';
import Colors from '../../constants/Colors';
import { FontSize, Radius, Shadow, Spacing } from '../../constants/Theme';
import AlertModal from '../../components/AlertModal';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, msg: '' });

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

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

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
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              placeholder="Email atau nomor HP"
              placeholderTextColor={Colors.textHint}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>KATA SANDI</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor={Colors.textHint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotRow}>
            <Text style={styles.forgotText}>Lupa kata sandi?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={[Colors.primary, Colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginBtnGrad}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>🔑  Masuk</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footer}>v1.0.0 · <Text style={styles.footerBrand}>SD Bintang Juara</Text> · 2025</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  header: { paddingTop: 52, paddingBottom: 60, paddingHorizontal: 20, alignItems: 'center', position: 'relative' },
  headerCurve: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 36, backgroundColor: '#fff', borderTopLeftRadius: 200, borderTopRightRadius: 200 },
  logoBox: { width: 90, height: 90, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadow.md },
  logoImage: { width: 78, height: 78 },
  schoolSub: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginTop: 4 },

  body: { padding: Spacing.md, paddingTop: Spacing.lg },
  greeting: { fontSize: FontSize.xxl, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  greetingSub: { fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: Colors.textTertiary, marginTop: 4, marginBottom: Spacing.lg },

  label: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, marginBottom: 14, height: 52 },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: FontSize.md, fontFamily: 'Poppins_400Regular', color: Colors.textPrimary },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },

  forgotRow: { alignItems: 'flex-end', marginBottom: Spacing.lg },
  forgotText: { fontSize: FontSize.sm, fontFamily: 'Poppins_500Medium', color: Colors.primary },

  loginBtn: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.md },
  loginBtnGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { color: '#fff', fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold' },

  footer: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textHint, fontFamily: 'Poppins_400Regular', marginTop: Spacing.sm },
  footerBrand: { color: Colors.primary, fontFamily: 'Poppins_600SemiBold' },
});
