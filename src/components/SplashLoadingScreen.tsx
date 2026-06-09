import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, Animated,
  StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');
const BAR_W   = W * 0.58;
const SHIMMER = BAR_W * 0.42;
const MIN_MS  = 1500; // minimum tampil sebelum exit
const EXIT_MS = 400;  // durasi fade-out keluar

interface Props {
  isReady: boolean;   // true = auth check selesai
  onHide:  () => void; // dipanggil setelah exit animation selesai
}

export default function SplashLoadingScreen({ isReady, onHide }: Props) {
  const mountTime   = useRef(Date.now());
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(28)).current;
  const shimmerAnim = useRef(new Animated.Value(-SHIMMER)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  // ── Animasi masuk + shimmer loop ─────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 700, delay: 100, useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 700, delay: 100, useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: BAR_W + SHIMMER, duration: 1100, useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    ).start();
  }, []);

  // ── Tunggu isReady + minimum waktu, lalu animasi keluar ──────────────────
  useEffect(() => {
    if (!isReady) return;

    const elapsed   = Date.now() - mountTime.current;
    const remaining = Math.max(0, MIN_MS - elapsed);

    const timer = setTimeout(() => {
      Animated.timing(exitOpacity, {
        toValue: 0, duration: EXIT_MS, useNativeDriver: true,
      }).start(() => onHide());
    }, remaining);

    return () => clearTimeout(timer);
  }, [isReady]);

  return (
    <Animated.View style={[styles.wrapper, { opacity: exitOpacity }]}>
      <LinearGradient
        colors={['#0A2F6E', '#0D47A1', '#1565C0']}
        locations={[0, 0.45, 1]}
        style={styles.container}
      >
        {/* ── Konten utama ── */}
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Logo */}
          <View style={styles.logoRing}>
            <View style={styles.logoBg}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Nama sekolah */}
          <Text style={styles.schoolName}>Bintang Juara</Text>
          <Text style={styles.appName}>Presensi Guru Digital</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Progress bar */}
          <View style={styles.barContainer}>
            <Animated.View
              style={[
                styles.shimmer,
                { transform: [{ translateX: shimmerAnim }] },
              ]}
            />
          </View>

          {/* Label loading */}
          <Text style={styles.loadingText}>Memuat data...</Text>
        </Animated.View>

        {/* ── Footer ── */}
        <Animated.Text style={[styles.footer, { opacity: fadeAnim }]}>
          Powered by MangoSpot
        </Animated.Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    marginTop: -H * 0.06,
  },

  // Logo
  logoRing: {
    width: 116, height: 116, borderRadius: 58,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  logoBg: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: { width: 76, height: 76 },

  // Teks
  schoolName: {
    fontFamily: 'Poppins_700Bold', fontSize: 24,
    color: '#FFFFFF', letterSpacing: 0.3,
  },
  appName: {
    fontFamily: 'Poppins_400Regular', fontSize: 13,
    color: 'rgba(255,255,255,0.72)', marginTop: 3, letterSpacing: 0.8,
  },

  // Divider
  divider: {
    width: 40, height: 1.5, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 22, marginBottom: 28,
  },

  // Progress bar
  barContainer: {
    width: BAR_W, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  shimmer: {
    width: SHIMMER, height: 3, borderRadius: 2,
    backgroundColor: '#FFC107',
    shadowColor: '#FFC107', shadowOpacity: 0.8,
    shadowRadius: 6, elevation: 2,
  },

  loadingText: {
    fontFamily: 'Poppins_400Regular', fontSize: 11,
    color: 'rgba(255,255,255,0.5)', marginTop: 12, letterSpacing: 0.5,
  },

  // Footer
  footer: {
    position: 'absolute', bottom: H * 0.045,
    fontFamily: 'Poppins_400Regular', fontSize: 10.5,
    color: 'rgba(255,255,255,0.35)', letterSpacing: 0.6,
  },
});
