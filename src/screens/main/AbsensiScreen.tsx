import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Image,
  Animated,
} from "react-native";
import {
  ScrollView,
  PanGestureHandler,
  State as GestureState,
} from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { DeviceEventEmitter } from "react-native";
import { useAuth } from "../../context/AuthContext";
import {
  AbsentInfo,
  AbsentCheck,
  AbsentHistoryItem,
  MainTabParamList,
} from "../../types";
import {
  getAbsentInfo,
  getAbsentCheck,
  getAbsentHistory,
  getAllAbsentHistory,
  insertAbsent,
} from "../../services/absentService";
import { ColorPalette } from "../../constants/Colors";
import { useTheme } from "../../context/ThemeContext";
import { FontSize, Shadow } from "../../constants/Theme";
import AppHeader from "../../components/AppHeader";
import AlertModal from "../../components/AlertModal";
import HeaderActions from "../../components/HeaderActions";

function buildMapHtml(
  schoolLat: number, schoolLng: number, radius: number,
  userLat?: number, userLng?: number,
): string {
  const userScript = (userLat !== undefined && userLng !== undefined)
    ? `L.circleMarker([${userLat},${userLng}],{radius:9,color:'#fff',weight:2,fillColor:'#E53935',fillOpacity:1}).addTo(map);
       map.fitBounds([[${schoolLat},${schoolLng}],[${userLat},${userLng}]],{padding:[60,60]});`
    : `map.setView([${schoolLat},${schoolLng}],16);`;

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%;overflow:hidden}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var si=L.divIcon({html:'<div style="width:14px;height:14px;border-radius:50%;background:#1565C0;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',className:'',iconSize:[14,14],iconAnchor:[7,7]});
L.marker([${schoolLat},${schoolLng}],{icon:si}).addTo(map);
L.circle([${schoolLat},${schoolLng}],{radius:${radius},color:'#1565C0',weight:2,fillColor:'#1565C0',fillOpacity:.15}).addTo(map);
${userScript}
</script></body></html>`;
}

function hitungJarak(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Backend menyimpan waktu WIB tapi suffix "Z" (UTC) salah ditambahkan.
// Ambil langsung dari string agar tidak dikonversi timezone oleh JavaScript.
function formatJam(isoDate: string) {
  const match = isoDate.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "--:--";
}

function formatTanggal(isoDate: string) {
  const datePart = isoDate.split("T")[0]; // "2026-06-08"
  const d = new Date(datePart + "T00:00:00");
  return {
    tgl: String(d.getDate()).padStart(2, "0"),
    bln: d.toLocaleDateString("id-ID", { month: "short" }),
  };
}

function isToday(isoDate: string) {
  const datePart = isoDate.split("T")[0]; // "2026-06-08"
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return datePart === todayStr;
}

// Apakah jam sekarang sudah melewati jam deadline ("HH:MM:SS") dari jadwal presensi
function isPastDeadline(deadline: string | undefined) {
  if (!deadline) return false;
  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  return nowStr > deadline;
}

interface RiwayatHarian {
  dateKey: string;
  tgl: string;
  bln: string;
  masuk?: AbsentHistoryItem;
  pulang?: AbsentHistoryItem;
}

// Gabungkan scan IN & OUT mentah menjadi satu baris per tanggal.
function groupHistoryPerHari(items: AbsentHistoryItem[]): RiwayatHarian[] {
  const map = new Map<string, RiwayatHarian>();
  for (const item of items) {
    const dateKey = item.date.split("T")[0];
    let entry = map.get(dateKey);
    if (!entry) {
      const { tgl, bln } = formatTanggal(item.date);
      entry = { dateKey, tgl, bln };
      map.set(dateKey, entry);
    }
    if (item.type === "IN") {
      if (!entry.masuk || item.date < entry.masuk.date) entry.masuk = item;
    } else {
      if (!entry.pulang || item.date > entry.pulang.date) entry.pulang = item;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey),
  );
}

function getStatusCfg(colors: ColorPalette) {
  return {
    IN: { bg: colors.statusHadirBg, color: colors.statusHadir, label: "Masuk" },
    OUT: { bg: colors.statusIzinBg, color: colors.statusIzin, label: "Keluar" },
    INV: {
      bg: colors.statusAlphaBg,
      color: colors.statusAlpha,
      label: "Tidak Valid",
    },
  };
}

type LokasiStatus = "loading" | "found" | "out_range" | "error";

export default function AbsensiScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const STATUS_CFG = React.useMemo(() => getStatusCfg(colors), [colors]);
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const [absentInfo, setAbsentInfo] = useState<AbsentInfo | null>(null);
  const [checkStatus, setCheckStatus] = useState<AbsentCheck | null>(null);
  const [history, setHistory] = useState<AbsentHistoryItem[]>([]);
  const [allHistory, setAllHistory] = useState<AbsentHistoryItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const panRef = useRef<any>(null);
  const scrollRef = useRef<any>(null);
  const PULL_THRESHOLD = 80;
  const LOADING_HEIGHT = 60;
  const heroOverlayOpacity = pullY.interpolate({
    inputRange: [0, LOADING_HEIGHT],
    outputRange: [0, 0.75],
    extrapolate: "clamp",
  });
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const [showLokasi, setShowLokasi] = useState(false);
  const [lokasiStatus, setLokasiStatus] = useState<LokasiStatus>("loading");
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
    jarak: number;
  } | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [showKamera, setShowKamera] = useState(false);
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);

  const [alert, setAlert] = useState<{
    visible: boolean;
    type: "success" | "error" | "warning";
    title: string;
    msg: string;
  }>({ visible: false, type: "success", title: "", msg: "" });

  const cameraRef = useRef<CameraView>(null);
  const [camPermission, requestCamPermission] = useCameraPermissions();

  const loadData = useCallback(async () => {
    try {
      const [infoRes, checkRes, histRes] = await Promise.all([
        getAbsentInfo(),
        getAbsentCheck(),
        getAbsentHistory(),
      ]);
      if (infoRes.data.status) setAbsentInfo(infoRes.data.data);
      if (checkRes.data.status) setCheckStatus(checkRes.data.data);
      setHistory(histRes.data.data ?? []);
    } catch {
      // tetap tampil screen, data null
    } finally {
      setLoadingInit(false);
    }
  }, []);

  const doRefresh = useCallback(async () => {
    await Promise.all([
      loadData(),
      getAllAbsentHistory().then((res) => setAllHistory(res.data.data ?? [])),
    ]);
  }, [loadData]);

  const handleGestureEvent = useCallback(({ nativeEvent }: any) => {
    const { translationY } = nativeEvent;
    if (
      scrollYRef.current < 5 &&
      translationY > 0 &&
      !isRefreshingRef.current
    ) {
      pullY.setValue(Math.min(translationY * 0.45, LOADING_HEIGHT * 2));
    }
  }, []);

  const handleStateChange = useCallback(
    ({ nativeEvent }: any) => {
      const { state, translationY } = nativeEvent;
      if (
        state === GestureState.END ||
        state === GestureState.CANCELLED ||
        state === GestureState.FAILED
      ) {
        if (
          translationY >= PULL_THRESHOLD &&
          scrollYRef.current < 5 &&
          !isRefreshingRef.current
        ) {
          isRefreshingRef.current = true;
          setRefreshing(true);
          Animated.spring(pullY, {
            toValue: LOADING_HEIGHT,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }).start();
          Animated.timing(contentOpacity, {
            toValue: 0.25,
            duration: 200,
            useNativeDriver: true,
          }).start();
          doRefresh().finally(() => {
            setRefreshing(false);
            isRefreshingRef.current = false;
            Animated.spring(pullY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 40,
              friction: 8,
            }).start();
            Animated.timing(contentOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          });
        } else if (!isRefreshingRef.current) {
          Animated.spring(pullY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }).start();
        }
      }
    },
    [doRefresh],
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    getAllAbsentHistory()
      .then((res) => setAllHistory(res.data.data ?? []))
      .catch(() => {});
  }, []);

  // Refresh otomatis saat admin hapus / nonaktifkan absensi via WS
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('ws:absent', () => { doRefresh(); });
    return () => sub.remove();
  }, [doRefresh]);

  // Derived
  const sekolahLat = parseFloat(absentInfo?.maps.lat ?? "0");
  const sekolahLng = parseFloat(absentInfo?.maps.lng ?? "0");
  const sekolahRadius = parseInt(absentInfo?.maps.radius ?? "1000");
  const sekolahNama = absentInfo?.name ?? "Sekolah";

  const groupedHistory = React.useMemo(
    () => groupHistoryPerHari(history),
    [history],
  );
  const RIWAYAT_LIMIT = 5;

  const todayIN = history.find((h) => h.type === "IN" && isToday(h.date));
  const todayOUT = history.find((h) => h.type === "OUT" && isToday(h.date));
  const checkInTime = todayIN ? formatJam(todayIN.date) : null;
  const checkOutTime = todayOUT ? formatJam(todayOUT.date) : null;
  const aksiAbsen = checkStatus?.absent.type === "OUT" ? "keluar" : "masuk";

  const lokasiAktif = checkStatus?.location?.status === true;
  const sudahAbsen  = checkStatus?.double.status === false;
  const btnDisabled = !lokasiAktif || sudahAbsen;
  const btnDisabledMsg = !lokasiAktif
    ? "Absensi via perangkat fingerprint"
    : (checkStatus?.double.info ?? "Anda sudah absen");

  const firstName = user?.name?.split(" ")[0] ?? "Guru";
  const sapaanGender =
    user?.gender === "male" ? "Bapak" : user?.gender === "female" ? "Ibu" : "";
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayStatus = checkInTime
    ? checkOutTime
      ? "Selesai"
      : "Sudah Masuk"
    : checkOutTime
      ? "Lupa Absen Masuk"
      : "Belum Absen";
  const badgeColor = checkInTime
    ? { bg: colors.successLight, text: colors.success }
    : checkOutTime
      ? { bg: colors.errorLight, text: colors.error }
      : { bg: colors.warningLight, text: colors.warning };

  const lupaMasuk =
    !checkInTime && isPastDeadline(checkStatus?.presence.endstart);
  const lupaPulang =
    !checkOutTime && isPastDeadline(checkStatus?.presence.endfinish);

  // Warna gradasi yang dipakai di header — reuse untuk hero supaya konsisten
  const headerColors = ["#0D47A1", "#1565C0", "#42A5F5"] as const;

  // ── MODAL LOKASI ──────────────────────────────────────────────────────────
  const bukaModalLokasi = async () => {
    setLokasiStatus("loading");
    setUserCoords(null);
    setShowLokasi(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = sekolahLat,
        lng = sekolahLng,
        jarak = 9999;
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        jarak = Math.round(hitungJarak(lat, lng, sekolahLat, sekolahLng));
      }
      setUserCoords({ lat, lng, jarak });
      setLokasiStatus(jarak <= sekolahRadius ? "found" : "out_range");
    } catch {
      setLokasiStatus("error");
    }
  };

  const lanjutKeFoto = () => {
    if (!userCoords) return;
    setPendingCoords({ lat: userCoords.lat, lng: userCoords.lng });
    setShowLokasi(false);
    setFotoUri(null);
    setFotoBase64(null);
    setShowKamera(true);
  };

  // ── MODAL KAMERA ──────────────────────────────────────────────────────────
  const ambilFoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        exif: false,
      });
      if (photo) {
        setFotoUri(photo.uri);
        setFotoBase64(photo.base64 ?? null);
      }
    } catch {
      setAlert({
        visible: true,
        type: "error",
        title: "Gagal",
        msg: "Tidak dapat mengambil foto.",
      });
    }
  };

  const konfirmasiAbsen = async () => {
    if (!pendingCoords || !fotoBase64) return;
    setSubmitting(true);
    try {
      const res = await insertAbsent(
        pendingCoords.lat,
        pendingCoords.lng,
        fotoBase64,
        true,
      );
      if (res.data.status) {
        setShowKamera(false);
        await loadData();
        setAlert({
          visible: true,
          type: "success",
          title: "Absensi Berhasil",
          msg: `Absen ${aksiAbsen} berhasil dicatat.`,
        });
      } else {
        setAlert({
          visible: true,
          type: "error",
          title: "Gagal",
          msg: res.data.data ?? "Terjadi kesalahan.",
        });
      }
    } catch {
      setAlert({
        visible: true,
        type: "error",
        title: "Gagal",
        msg: "Tidak dapat terhubung ke server.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInit) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader
        colors={headerColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerBlend}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>
              Assalamu'alaikum,{" "}
              {sapaanGender ? `${sapaanGender} ${firstName}` : firstName}
            </Text>
            <Text style={styles.subGreeting}>Absensi Guru</Text>
          </View>
          <HeaderActions variant="hero" />
        </View>
      </AppHeader>

      <PanGestureHandler
        ref={panRef}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleStateChange}
        simultaneousHandlers={scrollRef}
      >
        <Animated.View style={{ flex: 1 }}>
          <View style={styles.pullLoadingWrap}>
            {refreshing && (
              <ActivityIndicator color={colors.textTertiary} size="large" />
            )}
          </View>
          <Animated.View
            style={{ flex: 1, transform: [{ translateY: pullY }] }}
          >
            <ScrollView
              ref={scrollRef}
              simultaneousHandlers={panRef}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              onScroll={(e) => {
                scrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <LinearGradient
                colors={headerColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCurve}
              >
                <View style={styles.heroDateWrap}>
                  <Ionicons name="calendar-outline" size={12} color="#fff" />
                  <Text style={styles.heroDate}>{today}</Text>
                </View>
                <Animated.View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: colors.background,
                      opacity: heroOverlayOpacity,
                    },
                  ]}
                />
              </LinearGradient>

              <Animated.View style={{ opacity: contentOpacity }}>
                <View style={styles.body}>
                  {/* ── KARTU ABSENSI ── */}
                  <View style={[styles.attendCard, Shadow.md]}>
                    <View style={styles.attendTop}>
                      <Text style={styles.cardTitle}>Presensi Hari Ini</Text>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: badgeColor.bg },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: badgeColor.text }]}
                        >
                          {todayStatus}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.timesRow}>
                      <View style={styles.timeBox}>
                        <Text style={styles.timeLabel}>Jam Masuk</Text>
                        <Text
                          style={[
                            styles.timeVal,
                            !checkInTime &&
                              (lupaMasuk ? styles.timeLupa : styles.timeEmpty),
                          ]}
                        >
                          {checkInTime ?? (lupaMasuk ? "Lupa Masuk" : "--:--")}
                        </Text>
                      </View>
                      <View style={styles.timeBox}>
                        <Text style={styles.timeLabel}>Jam Keluar</Text>
                        <Text
                          style={[
                            styles.timeVal,
                            !checkOutTime &&
                              (lupaPulang ? styles.timeLupa : styles.timeEmpty),
                          ]}
                        >
                          {checkOutTime ??
                            (lupaPulang ? "Lupa Pulang" : "--:--")}
                        </Text>
                      </View>
                    </View>
                    {checkOutTime && !lokasiAktif ? (
                      <View style={styles.checkBtn}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#fff"
                        />
                        <View>
                          <Text style={styles.checkBtnText}>
                            Absensi Selesai
                          </Text>
                          <Text style={styles.checkBtnSub}>
                            Sampai Jumpa Besok Hari
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.checkBtn,
                            btnDisabled && styles.checkBtnDisabled,
                          ]}
                          onPress={btnDisabled ? undefined : bukaModalLokasi}
                          disabled={btnDisabled}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="location" size={20} color="#fff" />
                          <View>
                            <Text style={styles.checkBtnText}>
                              Absen Via Lokasi
                            </Text>
                            <Text style={styles.checkBtnSub}>
                              {aksiAbsen === "masuk"
                                ? "Absen Masuk"
                                : "Absen Keluar"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        {btnDisabled && (
                          <Text style={styles.checkBtnMsg}>
                            {btnDisabledMsg}
                          </Text>
                        )}
                      </>
                    )}
                  </View>

                  {/* ── INFO SHIFT ── */}
                  {absentInfo?.data && (
                    <View style={[styles.shiftCard, Shadow.sm]}>
                      <Ionicons
                        name="time-outline"
                        size={15}
                        color={colors.primary}
                      />
                      <Text style={styles.shiftText}>
                        <Text style={{ fontFamily: "Poppins_600SemiBold" }}>
                          {absentInfo.data.name}
                        </Text>
                        {"  ·  "}Masuk{" "}
                        <Text
                          style={{
                            color: colors.statusHadir,
                            fontFamily: "Poppins_600SemiBold",
                          }}
                        >
                          {absentInfo.data.input.slice(0, 5)}
                        </Text>
                        {"  ·  "}Keluar{" "}
                        <Text
                          style={{
                            color: colors.statusAlpha,
                            fontFamily: "Poppins_600SemiBold",
                          }}
                        >
                          {absentInfo.data.output.slice(0, 5)}
                        </Text>
                      </Text>
                    </View>
                  )}

                  {/* ── STATISTIK ── */}
                  <View style={styles.sumStrip}>
                    {[
                      {
                        num: allHistory.filter(
                          (h) => h.type === "IN" && h.valid,
                        ).length,
                        label: "Masuk",
                        color: colors.statusHadir,
                      },
                      {
                        num: allHistory.filter(
                          (h) => h.type === "OUT" && h.valid,
                        ).length,
                        label: "Keluar",
                        color: colors.statusIzin,
                      },
                      {
                        num: allHistory.filter((h) => !h.valid).length,
                        label: "Invalid",
                        color: colors.statusAlpha,
                      },
                      {
                        num: allHistory.length,
                        label: "Total",
                        color: colors.primary,
                      },
                    ].map((item) => (
                      <View
                        key={item.label}
                        style={[styles.sumItem, Shadow.sm]}
                      >
                        <Text style={[styles.sumNum, { color: item.color }]}>
                          {item.num}
                        </Text>
                        <Text style={styles.sumLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* ── RIWAYAT ── */}
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Riwayat Absensi</Text>
                  </View>

                  {groupedHistory.length === 0 ? (
                    <View style={[styles.emptyBox, Shadow.sm]}>
                      <Ionicons
                        name="calendar-outline"
                        size={36}
                        color={colors.textHint}
                      />
                      <Text style={styles.emptyText}>
                        Belum ada riwayat absensi
                      </Text>
                    </View>
                  ) : (
                    <>
                      {groupedHistory.slice(0, RIWAYAT_LIMIT).map((g) => {
                        const masukSc = g.masuk
                          ? !g.masuk.valid
                            ? STATUS_CFG.INV
                            : STATUS_CFG.IN
                          : null;
                        const pulangSc = g.pulang
                          ? !g.pulang.valid
                            ? STATUS_CFG.INV
                            : STATUS_CFG.OUT
                          : null;
                        return (
                          <View
                            key={g.dateKey}
                            style={[styles.histItem, Shadow.sm]}
                          >
                            <View style={styles.dateBox}>
                              <Text style={styles.dateDay}>{g.tgl}</Text>
                              <Text style={styles.dateMonth}>{g.bln}</Text>
                            </View>

                            <View style={styles.histCol}>
                              {g.masuk && masukSc ? (
                                <>
                                  <Text
                                    style={[
                                      styles.histJam,
                                      { color: masukSc.color },
                                    ]}
                                  >
                                    {formatJam(g.masuk.date)}
                                  </Text>
                                  <View
                                    style={[
                                      styles.chip,
                                      { backgroundColor: masukSc.bg },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.chipText,
                                        { color: masukSc.color },
                                      ]}
                                    >
                                      {masukSc.label}
                                    </Text>
                                  </View>
                                </>
                              ) : (
                                <Text
                                  style={[
                                    styles.histJamEmpty,
                                    styles.histJamEmptySmall,
                                  ]}
                                >
                                  {isToday(g.dateKey) &&
                                  !isPastDeadline(
                                    checkStatus?.presence.endstart,
                                  )
                                    ? "--:--"
                                    : "Lupa\nmasuk"}
                                </Text>
                              )}
                            </View>

                            <View style={styles.histColDivider} />

                            <View style={styles.histCol}>
                              {g.pulang && pulangSc ? (
                                <>
                                  <Text
                                    style={[
                                      styles.histJam,
                                      { color: pulangSc.color },
                                    ]}
                                  >
                                    {formatJam(g.pulang.date)}
                                  </Text>
                                  <View
                                    style={[
                                      styles.chip,
                                      { backgroundColor: pulangSc.bg },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.chipText,
                                        { color: pulangSc.color },
                                      ]}
                                    >
                                      {pulangSc.label}
                                    </Text>
                                  </View>
                                </>
                              ) : (
                                <Text
                                  style={[
                                    styles.histJamEmpty,
                                    styles.histJamEmptySmall,
                                  ]}
                                >
                                  {isToday(g.dateKey) &&
                                  !isPastDeadline(
                                    checkStatus?.presence.endfinish,
                                  )
                                    ? "Belum\npulang"
                                    : "Lupa\npulang"}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })}

                      {groupedHistory.length > RIWAYAT_LIMIT && (
                        <TouchableOpacity
                          style={styles.lihatSemuaBtn}
                          onPress={() => navigation.navigate("Laporan")}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.lihatSemuaText}>
                            Lihat Semua Riwayat
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  <View style={{ height: 20 }} />
                </View>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>

      {/* ═══════ MODAL LOKASI ═══════ */}
      <Modal
        visible={showLokasi}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLokasi(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, Shadow.md]}>
            <Text style={styles.modalTitle}>Cek Lokasi</Text>
            <Text style={styles.modalSub}>
              Aksi:{" "}
              <Text
                style={{ fontFamily: "Poppins_700Bold", color: colors.primary }}
              >
                Absen {aksiAbsen === "masuk" ? "Masuk" : "Keluar"}
              </Text>
            </Text>

            <View style={styles.mapWrap}>
              {sekolahLat !== 0 && (
                <WebView
                  key={userCoords ? `${userCoords.lat}-${userCoords.lng}` : "init"}
                  source={{ html: buildMapHtml(sekolahLat, sekolahLng, sekolahRadius, userCoords?.lat, userCoords?.lng) }}
                  style={{ flex: 1 }}
                  originWhitelist={["*"]}
                  scrollEnabled={false}
                />
              )}
              {lokasiStatus === "loading" && (
                <View style={styles.mapOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.mapOverlayText}>Mendeteksi lokasi GPS...</Text>
                </View>
              )}
              {lokasiStatus === "error" && (
                <View style={[styles.mapOverlay, { backgroundColor: colors.background }]}>
                  <Ionicons name="location-outline" size={36} color={colors.textHint} />
                  <Text style={styles.mapOverlayText}>Gagal mendapatkan lokasi</Text>
                </View>
              )}
            </View>

            {lokasiStatus === "found" && userCoords && (
              <View style={styles.lokasiInfoBox}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lokasiInfoTitle}>{sekolahNama}</Text>
                  <Text style={styles.lokasiInfoAddr}>
                    Jarak: {userCoords.jarak}m · Radius: {sekolahRadius}m
                  </Text>
                </View>
              </View>
            )}
            {lokasiStatus === "out_range" && userCoords && (
              <View style={[styles.lokasiInfoBox, styles.lokasiInfoWarning]}>
                <Ionicons name="warning" size={20} color={colors.warning} />
                <Text style={[styles.lokasiInfoTitle, { color: colors.warning, flex: 1 }]}>
                  Di luar area sekolah ({userCoords.jarak}m)
                </Text>
              </View>
            )}
            {lokasiStatus === "error" && (
              <View style={[styles.lokasiInfoBox, styles.lokasiInfoWarning]}>
                <Ionicons name="close-circle" size={20} color={colors.error} />
                <Text style={[styles.lokasiInfoTitle, { color: colors.error, flex: 1 }]}>
                  Gagal mendapatkan lokasi
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              {lokasiStatus === "found" && (
                <TouchableOpacity
                  style={styles.konfirmasiBtn}
                  onPress={lanjutKeFoto}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.konfirmBtnText}>Lanjut Ambil Foto</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.batalBtn}
                onPress={() => setShowLokasi(false)}
              >
                <Text style={styles.batalBtnText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════ MODAL KAMERA ═══════ */}
      <Modal
        visible={showKamera}
        animationType="slide"
        onRequestClose={() => !submitting && setShowKamera(false)}
      >
        <View style={styles.kameraRoot}>
          {fotoUri ? (
            /* ── PREVIEW FOTO ── */
            <>
              <Image source={{ uri: fotoUri }} style={styles.kameraFill} />
              <View style={styles.kameraHeader}>
                <Text style={styles.kameraJudul}>Preview Foto</Text>
              </View>
              <View style={styles.kameraBottom}>
                <TouchableOpacity
                  style={styles.kameraAksiBtn}
                  onPress={() => {
                    setFotoUri(null);
                    setFotoBase64(null);
                  }}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.kameraAksiBtnText}>Ambil Ulang</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.kameraAksiBtn,
                    styles.kameraAksiBtnPrimary,
                    submitting && { opacity: 0.7 },
                  ]}
                  onPress={konfirmasiAbsen}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.kameraAksiBtnText}>
                        Konfirmasi Absen{" "}
                        {aksiAbsen === "masuk" ? "Masuk" : "Keluar"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : !camPermission?.granted ? (
            /* ── MINTA IZIN KAMERA ── */
            <View style={styles.kameraPermWrap}>
              <Ionicons
                name="camera-outline"
                size={64}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.kameraPermText}>
                Izin kamera diperlukan untuk foto absensi
              </Text>
              <TouchableOpacity
                style={styles.kameraPermBtn}
                onPress={requestCamPermission}
              >
                <Text style={styles.kameraPermBtnText}>
                  Berikan Izin Kamera
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── LIVE KAMERA ── */
            <>
              <CameraView
                ref={cameraRef}
                style={styles.kameraFill}
                facing="front"
              />
              <View style={styles.kameraHeader}>
                <Text style={styles.kameraJudul}>Foto Wajah</Text>
                <Text style={styles.kameraSubJudul}>
                  Pastikan wajah terlihat jelas
                </Text>
              </View>
              <View style={styles.kameraBottom}>
                <TouchableOpacity
                  style={styles.shutterBtn}
                  onPress={ambilFoto}
                  activeOpacity={0.8}
                >
                  <View style={styles.shutterInner} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Tombol kembali */}
          {!submitting && (
            <TouchableOpacity
              style={styles.kameraBackBtn}
              onPress={() => setShowKamera(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.msg}
        onClose={() => setAlert((a) => ({ ...a, visible: false }))}
      />
    </View>
  );
}

const getStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    headerBlend: { elevation: 0, shadowOpacity: 0 },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerInfo: { flex: 1, paddingRight: 12 },
    greeting: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontFamily: "Poppins_700Bold",
    },
    subGreeting: {
      color: "rgba(255,255,255,0.78)",
      fontSize: 11,
      fontFamily: "Poppins_400Regular",
      marginTop: 1,
    },
    heroCurve: {
      height: 180,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomLeftRadius: 34,
      borderBottomRightRadius: 34,
      overflow: "hidden",
      justifyContent: "flex-start",
    },
    heroDateWrap: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: 20,
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    heroDate: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontFamily: "Poppins_600SemiBold",
    },

    body: { paddingHorizontal: 14, marginTop: -100 },

    attendCard: {
      backgroundColor: colors.white,
      borderRadius: 20,
      padding: 18,
      marginBottom: 12,
    },
    attendTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: FontSize.md,
      fontFamily: "Poppins_600SemiBold",
      color: colors.textPrimary,
    },
    badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
    badgeText: { fontSize: FontSize.xs - 1, fontFamily: "Poppins_600SemiBold" },
    timesRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
    timeBox: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
    },
    timeLabel: {
      fontSize: FontSize.xs,
      color: colors.textTertiary,
      marginBottom: 4,
    },
    timeVal: {
      fontSize: 26,
      fontFamily: "Poppins_700Bold",
      color: colors.textPrimary,
    },
    timeEmpty: { color: colors.textHint },
    timeLupa: { color: colors.error, fontSize: FontSize.sm },
    checkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      paddingVertical: 15,
      borderRadius: 14,
    },
    checkBtnDisabled: {
      backgroundColor: colors.textHint,
      opacity: 0.75,
    },
    checkBtnMsg: {
      textAlign: "center",
      fontSize: FontSize.xs - 1,
      color: colors.textTertiary,
      fontFamily: "Poppins_400Regular",
      marginTop: 7,
    },
    checkBtnText: {
      color: "#fff",
      fontSize: FontSize.md,
      fontFamily: "Poppins_600SemiBold",
    },
    checkBtnSub: {
      color: "rgba(255,255,255,0.8)",
      fontSize: FontSize.xs - 2,
      fontFamily: "Poppins_400Regular",
    },

    shiftCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.white,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    shiftText: {
      flex: 1,
      fontSize: FontSize.xs,
      color: colors.textSecondary,
      fontFamily: "Poppins_400Regular",
    },

    sectionHeader: { marginBottom: 10 },
    sectionTitle: {
      fontSize: FontSize.md,
      fontFamily: "Poppins_600SemiBold",
      color: colors.textPrimary,
    },

    emptyBox: {
      backgroundColor: colors.white,
      borderRadius: 14,
      padding: 28,
      alignItems: "center",
      gap: 10,
    },
    emptyText: {
      fontSize: FontSize.sm,
      color: colors.textTertiary,
      fontFamily: "Poppins_400Regular",
    },

    histItem: {
      backgroundColor: colors.white,
      borderRadius: 14,
      padding: 12,
      paddingHorizontal: 14,
      flexDirection: "row",
      gap: 10,
      alignItems: "stretch",
      marginBottom: 9,
    },
    dateBox: {
      width: 44,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryXLight,
    },
    dateDay: {
      fontSize: 17,
      fontFamily: "Poppins_700Bold",
      lineHeight: 20,
      color: colors.primary,
    },
    dateMonth: {
      fontSize: 9,
      textTransform: "uppercase",
      fontFamily: "Poppins_500Medium",
      color: colors.primary,
    },
    histCol: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    histColDivider: {
      width: 1,
      alignSelf: "stretch",
      backgroundColor: colors.border,
    },
    chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    chipText: { fontSize: FontSize.xs - 2, fontFamily: "Poppins_500Medium" },
    histJam: { fontSize: FontSize.md, fontFamily: "Poppins_700Bold" },
    histJamEmpty: {
      fontSize: FontSize.sm,
      fontFamily: "Poppins_500Medium",
      color: colors.textHint,
    },
    histJamEmptySmall: {
      fontSize: FontSize.xs,
      textAlign: "center",
      lineHeight: 15,
    },
    lihatSemuaBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 12,
      marginBottom: 4,
    },
    lihatSemuaText: {
      fontSize: FontSize.sm,
      fontFamily: "Poppins_600SemiBold",
      color: colors.primary,
    },

    // Modal shared
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 36,
    },
    modalTitle: {
      fontSize: FontSize.lg,
      fontFamily: "Poppins_700Bold",
      color: colors.textPrimary,
      textAlign: "center",
    },
    modalSub: {
      fontSize: FontSize.xs,
      fontFamily: "Poppins_400Regular",
      color: colors.textTertiary,
      textAlign: "center",
      marginBottom: 14,
    },

    mapWrap: {
      borderRadius: 16,
      overflow: "hidden",
      height: 220,
      marginBottom: 12,
      position: "relative",
    },
    mapOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(255,255,255,0.85)",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    mapOverlayText: {
      fontSize: FontSize.sm,
      fontFamily: "Poppins_500Medium",
      color: colors.primary,
    },
    lokasiInfoBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.successLight,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    lokasiInfoWarning: { backgroundColor: colors.warningLight },
    lokasiInfoTitle: {
      fontSize: FontSize.sm,
      fontFamily: "Poppins_600SemiBold",
      color: colors.textPrimary,
    },
    lokasiInfoAddr: {
      fontSize: FontSize.xs - 1,
      color: colors.textSecondary,
      fontFamily: "Poppins_400Regular",
    },

    // Kamera full-screen
    kameraRoot: { flex: 1, backgroundColor: "#000" },
    kameraFill: { ...StyleSheet.absoluteFillObject },
    kameraHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 56,
      paddingHorizontal: 20,
      paddingBottom: 20,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
    },
    kameraJudul: {
      color: "#fff",
      fontSize: FontSize.md,
      fontFamily: "Poppins_700Bold",
    },
    kameraSubJudul: {
      color: "rgba(255,255,255,0.75)",
      fontSize: FontSize.xs,
      fontFamily: "Poppins_400Regular",
      marginTop: 2,
    },
    kameraBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 48,
      paddingHorizontal: 24,
      paddingTop: 20,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      gap: 12,
    },
    shutterBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    shutterInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#fff",
    },
    kameraAksiBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "rgba(255,255,255,0.25)",
      paddingVertical: 13,
      paddingHorizontal: 20,
      borderRadius: 12,
      width: "100%",
    },
    kameraAksiBtnPrimary: { backgroundColor: colors.primary },
    kameraAksiBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontFamily: "Poppins_600SemiBold",
    },
    kameraBackBtn: {
      position: "absolute",
      top: 52,
      left: 16,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    kameraPermWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      paddingHorizontal: 32,
    },
    kameraPermText: {
      color: "rgba(255,255,255,0.75)",
      fontSize: FontSize.sm,
      fontFamily: "Poppins_400Regular",
      textAlign: "center",
    },
    kameraPermBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      marginTop: 8,
    },
    kameraPermBtnText: {
      color: "#fff",
      fontSize: FontSize.sm,
      fontFamily: "Poppins_600SemiBold",
    },

    modalActions: { gap: 8 },
    konfirmasiBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
    },
    konfirmBtnText: {
      color: "#fff",
      fontSize: FontSize.md,
      fontFamily: "Poppins_600SemiBold",
    },
    batalBtn: { paddingVertical: 12, alignItems: "center" },
    batalBtnText: {
      fontSize: FontSize.md,
      fontFamily: "Poppins_500Medium",
      color: colors.textTertiary,
    },
    pullLoadingWrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 60,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    sumStrip: { flexDirection: "row", gap: 8, marginBottom: 14 },
    sumItem: {
      flex: 1,
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: 10,
      alignItems: "center",
    },
    sumNum: { fontSize: FontSize.xl, fontFamily: "Poppins_700Bold" },
    sumLabel: {
      fontSize: FontSize.xs - 2,
      color: colors.textTertiary,
      marginTop: 1,
      fontFamily: "Poppins_400Regular",
    },
  });
