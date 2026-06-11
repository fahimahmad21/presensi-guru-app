import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../types';
import { ColorPalette } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, Radius, Spacing } from '../../constants/Theme';
import AlertModal from '../../components/AlertModal';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'> };

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [alert, setAlert] = useState({ visible: false, msg: '' });

  const handleKirimOtp = async () => {
    if (!email.trim()) {
      setAlert({ visible: true, msg: 'Masukkan alamat email terdaftar Anda.' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setTerkirim(true);
    }, 1500);
  };

  const handleOtp = (val: string, idx: number) => {
    const next = [...otp];
    next[idx] = val.replace(/\D/g, '').slice(-1);
    setOtp(next);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lupa Kata Sandi</Text>
        </LinearGradient>

        <View style={styles.body}>
          {/* ── ILUSTRASI ── */}
          <View style={styles.illustBox}>
            <Text style={styles.illustEmoji}>🔑</Text>
          </View>

          <Text style={styles.title}>Atur Ulang Kata Sandi</Text>
          <Text style={styles.subtitle}>
            Masukkan email terdaftar Anda.{'\n'}Kami akan mengirimkan kode OTP.
          </Text>

          <Text style={styles.label}>EMAIL</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="guru@bintangjuara.sch.id"
              placeholderTextColor={colors.textHint}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.sendBtn} onPress={handleKirimOtp} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendBtnGrad}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.sendBtnText}>📨  Kirim Kode OTP</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backToLoginBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backToLoginText}>← Kembali ke Halaman Masuk</Text>
          </TouchableOpacity>

          {/* ── INPUT OTP ── */}
          <View style={[styles.otpBox, !terkirim && styles.otpBoxDisabled]}>
            {terkirim ? (
              <>
                <Text style={styles.otpLabel}>Masukkan kode OTP 6 digit</Text>
                <View style={styles.otpRow}>
                  {otp.map((v, i) => (
                    <TextInput
                      key={i}
                      style={styles.otpInput}
                      value={v}
                      onChangeText={val => handleOtp(val, i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                    />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.otpPlaceholder}>Kolom OTP (6 digit) muncul di sini</Text>
            )}
          </View>
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

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 52, paddingBottom: 22, paddingHorizontal: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: FontSize.lg, fontFamily: 'Poppins_600SemiBold' },

  body: { padding: Spacing.md, paddingTop: Spacing.lg },

  illustBox: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.primaryXLight, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.md },
  illustEmoji: { fontSize: 52 },

  title: { fontSize: FontSize.xl, fontFamily: 'Poppins_700Bold', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: FontSize.sm, fontFamily: 'Poppins_400Regular', color: colors.textTertiary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },

  label: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: Radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, marginBottom: 14, height: 52 },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: FontSize.md, fontFamily: 'Poppins_400Regular', color: colors.textPrimary },

  sendBtn: { borderRadius: Radius.md, overflow: 'hidden', marginBottom: 12 },
  sendBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold' },

  backToLoginBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.lg },
  backToLoginText: { color: colors.primary, fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold' },

  otpBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: Radius.md, padding: 18, alignItems: 'center', minHeight: 68, justifyContent: 'center' },
  otpBoxDisabled: { opacity: 0.4 },
  otpPlaceholder: { fontSize: FontSize.xs, color: colors.textHint, fontFamily: 'Poppins_400Regular' },
  otpLabel: { fontSize: FontSize.xs, fontFamily: 'Poppins_500Medium', color: colors.textSecondary, marginBottom: 14 },
  otpRow: { flexDirection: 'row', gap: 10 },
  otpInput: { width: 44, height: 54, borderWidth: 1.5, borderColor: colors.primary, borderRadius: Radius.sm, fontSize: FontSize.xl, fontFamily: 'Poppins_700Bold', color: colors.primary, backgroundColor: colors.primaryXLight },
});
