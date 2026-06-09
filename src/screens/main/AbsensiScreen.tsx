import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../context/AuthContext";
import { AbsentInfo, AbsentCheck, AbsentHistoryItem } from "../../types";
import {
  getAbsentInfo,
  getAbsentCheck,
  getAbsentHistory,
  insertAbsent,
} from "../../services/absentService";
import Colors from "../../constants/Colors";
import { FontSize, Shadow } from "../../constants/Theme";
import AppHeader from "../../components/AppHeader";
import AlertModal from "../../components/AlertModal";
import HeaderActions from "../../components/HeaderActions";

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

const STATUS_CFG = {
  IN: { bg: Colors.statusHadirBg, color: Colors.statusHadir, label: "Masuk" },
  OUT: { bg: Colors.statusIzinBg, color: Colors.statusIzin, label: "Keluar" },
  INV: {
    bg: Colors.statusAlphaBg,
    color: Colors.statusAlpha,
    label: "Tidak Valid",
  },
};

type LokasiStatus = "loading" | "found" | "out_range" | "error";

export default function AbsensiScreen() {
  const { user } = useAuth();

  const [absentInfo, setAbsentInfo] = useState<AbsentInfo | null>(null);
  const [checkStatus, setCheckStatus] = useState<AbsentCheck | null>(null);
  const [history, setHistory] = useState<AbsentHistoryItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const mapRef = useRef<MapView>(null);

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

  useEffect(() => {
    loadData();
  }, []);

  // Derived
  const sekolahLat = parseFloat(absentInfo?.maps.lat ?? "0");
  const sekolahLng = parseFloat(absentInfo?.maps.lng ?? "0");
  const sekolahRadius = parseInt(absentInfo?.maps.radius ?? "100");
  const sekolahNama = absentInfo?.name ?? "Sekolah";

  const aksiAbsen = checkStatus?.absent.type === "OUT" ? "keluar" : "masuk";
  const todayIN = history.find((h) => h.type === "IN" && isToday(h.date));
  const todayOUT = history.find((h) => h.type === "OUT" && isToday(h.date));
  const checkInTime = todayIN ? formatJam(todayIN.date) : null;
  const checkOutTime = todayOUT ? formatJam(todayOUT.date) : null;

  const firstName = user?.name?.split(" ")[0] ?? "Guru";
  const sapaanGender = user?.gender === 'L' ? 'Bapak' : user?.gender === 'P' ? 'Ibu' : '';
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const badgeColor = checkInTime
    ? { bg: Colors.successLight, text: Colors.success }
    : { bg: Colors.warningLight, text: Colors.warning };
  const todayStatus = checkInTime
    ? checkOutTime
      ? "Selesai"
      : "Sudah Masuk"
    : "Belum Absen";

  const mapInitial = {
    latitude: userCoords?.lat ?? (sekolahLat || -7.022846),
    longitude: userCoords?.lng ?? (sekolahLng || 110.387202),
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
  };

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
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: lat, longitude: lng },
            { latitude: sekolahLat, longitude: sekolahLng },
          ],
          {
            edgePadding: { top: 60, bottom: 60, left: 40, right: 40 },
            animated: true,
          },
        );
      }, 300);
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
  const bukaKamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setAlert({
        visible: true,
        type: "warning",
        title: "Izin Kamera",
        msg: "Izin kamera diperlukan untuk absensi.",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setFotoUri(result.assets[0].uri);
      setFotoBase64(result.assets[0].base64 ?? null);
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
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
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
            <Text style={styles.greeting}>Assalamu'alaikum, {sapaanGender ? `${sapaanGender} ${firstName}` : firstName}</Text>
            <Text style={styles.subGreeting}>Absensi Guru</Text>
          </View>
          <HeaderActions variant="hero" />
        </View>
      </AppHeader>

      <ScrollView showsVerticalScrollIndicator={false}>
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
        </LinearGradient>

        <View style={styles.body}>
          {/* ── KARTU ABSENSI ── */}
          <View style={[styles.attendCard, Shadow.md]}>
            <View style={styles.attendTop}>
              <Text style={styles.cardTitle}>Presensi Hari Ini</Text>
              <View style={[styles.badge, { backgroundColor: badgeColor.bg }]}>
                <Text style={[styles.badgeText, { color: badgeColor.text }]}>
                  {todayStatus}
                </Text>
              </View>
            </View>
            <View style={styles.timesRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Jam Masuk</Text>
                <Text
                  style={[styles.timeVal, !checkInTime && styles.timeEmpty]}
                >
                  {checkInTime ?? "--:--"}
                </Text>
              </View>
              <View style={styles.timeBox}>
                <Text style={styles.timeLabel}>Jam Keluar</Text>
                <Text
                  style={[styles.timeVal, !checkOutTime && styles.timeEmpty]}
                >
                  {checkOutTime ?? "--:--"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.checkBtn}
              onPress={bukaModalLokasi}
              activeOpacity={0.85}
            >
              <Ionicons name="location" size={20} color="#fff" />
              <View>
                <Text style={styles.checkBtnText}>Absen Via Lokasi</Text>
                <Text style={styles.checkBtnSub}>
                  {aksiAbsen === "masuk" ? "Absen Masuk" : "Absen Keluar"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── INFO SHIFT ── */}
          {absentInfo?.data && (
            <View style={[styles.shiftCard, Shadow.sm]}>
              <Ionicons name="time-outline" size={15} color={Colors.primary} />
              <Text style={styles.shiftText}>
                <Text style={{ fontFamily: "Poppins_600SemiBold" }}>
                  {absentInfo.data.name}
                </Text>
                {"  ·  "}Masuk{" "}
                <Text
                  style={{
                    color: Colors.statusHadir,
                    fontFamily: "Poppins_600SemiBold",
                  }}
                >
                  {absentInfo.data.input.slice(0, 5)}
                </Text>
                {"  ·  "}Keluar{" "}
                <Text
                  style={{
                    color: Colors.statusAlpha,
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
                num: history.filter((h) => h.type === "IN" && h.valid).length,
                label: "Masuk",
                color: Colors.statusHadir,
              },
              {
                num: history.filter((h) => h.type === "OUT" && h.valid).length,
                label: "Keluar",
                color: Colors.statusIzin,
              },
              {
                num: history.filter((h) => !h.valid).length,
                label: "Invalid",
                color: Colors.statusAlpha,
              },
              { num: history.length, label: "Total", color: Colors.primary },
            ].map((item) => (
              <View key={item.label} style={[styles.sumItem, Shadow.sm]}>
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

          {history.length === 0 ? (
            <View style={[styles.emptyBox, Shadow.sm]}>
              <Ionicons
                name="calendar-outline"
                size={36}
                color={Colors.textHint}
              />
              <Text style={styles.emptyText}>Belum ada riwayat absensi</Text>
            </View>
          ) : (
            history.map((item) => {
              const sc = !item.valid
                ? STATUS_CFG.INV
                : item.type === "IN"
                  ? STATUS_CFG.IN
                  : STATUS_CFG.OUT;
              const { tgl, bln } = formatTanggal(item.date);
              const jam = formatJam(item.date);
              return (
                <View key={item.id} style={[styles.histItem, Shadow.sm]}>
                  <View style={[styles.dateBox, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.dateDay, { color: sc.color }]}>
                      {tgl}
                    </Text>
                    <Text style={[styles.dateMonth, { color: sc.color }]}>
                      {bln}
                    </Text>
                  </View>
                  <View style={styles.histInfo}>
                    <Text style={styles.histName}>{item.device}</Text>
                    <View style={styles.chipRow}>
                      <View style={[styles.chip, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.chipText, { color: sc.color }]}>
                          {sc.label}
                        </Text>
                      </View>
                      {item.image && (
                        <View style={styles.chipImg}>
                          <Ionicons
                            name="camera-outline"
                            size={11}
                            color={Colors.primary}
                          />
                          <Text style={styles.chipImgText}>Foto</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.histJam, { color: sc.color }]}>
                    {jam}
                  </Text>
                </View>
              );
            })
          )}

          <View style={{ height: 20 }} />
        </View>
      </ScrollView>

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
                style={{ fontFamily: "Poppins_700Bold", color: Colors.primary }}
              >
                Absen {aksiAbsen === "masuk" ? "Masuk" : "Keluar"}
              </Text>
            </Text>

            <View style={styles.mapWrap}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={mapInitial}
                showsUserLocation
                showsMyLocationButton={false}
              >
                {sekolahLat !== 0 && (
                  <>
                    <Marker
                      coordinate={{
                        latitude: sekolahLat,
                        longitude: sekolahLng,
                      }}
                      title={sekolahNama}
                      pinColor={Colors.primary}
                    />
                    <Circle
                      center={{ latitude: sekolahLat, longitude: sekolahLng }}
                      radius={sekolahRadius}
                      strokeColor={Colors.primary}
                      strokeWidth={2}
                      fillColor="rgba(21,101,192,0.12)"
                    />
                  </>
                )}
                {userCoords && lokasiStatus !== "loading" && (
                  <Marker
                    coordinate={{
                      latitude: userCoords.lat,
                      longitude: userCoords.lng,
                    }}
                    title="Lokasi Saya"
                    pinColor="#E53935"
                  />
                )}
              </MapView>
              {lokasiStatus === "loading" && (
                <View style={styles.mapOverlay}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.mapOverlayText}>
                    Mendeteksi lokasi...
                  </Text>
                </View>
              )}
            </View>

            {lokasiStatus === "found" && userCoords && (
              <View style={styles.lokasiInfoBox}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={Colors.success}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lokasiInfoTitle}>{sekolahNama}</Text>
                  <Text style={styles.lokasiInfoAddr}>
                    Jarak: {userCoords.jarak} m · Radius: {sekolahRadius} m
                  </Text>
                </View>
              </View>
            )}
            {lokasiStatus === "out_range" && userCoords && (
              <View style={[styles.lokasiInfoBox, styles.lokasiInfoWarning]}>
                <Ionicons name="warning" size={20} color={Colors.warning} />
                <Text
                  style={[
                    styles.lokasiInfoTitle,
                    { color: Colors.warning, flex: 1 },
                  ]}
                >
                  Di luar area sekolah ({userCoords.jarak} m)
                </Text>
              </View>
            )}
            {lokasiStatus === "error" && (
              <View style={[styles.lokasiInfoBox, styles.lokasiInfoWarning]}>
                <Ionicons name="close-circle" size={20} color={Colors.error} />
                <Text
                  style={[
                    styles.lokasiInfoTitle,
                    { color: Colors.error, flex: 1 },
                  ]}
                >
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
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setShowKamera(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, Shadow.md]}>
            <Text style={styles.modalTitle}>Foto Wajah</Text>
            <Text style={styles.modalSub}>
              Ambil foto sebagai bukti kehadiran
            </Text>

            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
            ) : (
              <View style={styles.fotoPlaceholder}>
                <Ionicons
                  name="person-circle-outline"
                  size={72}
                  color={Colors.textHint}
                />
                <Text style={styles.fotoPlaceholderText}>Belum ada foto</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.konfirmasiBtn,
                  { backgroundColor: Colors.textSecondary },
                ]}
                onPress={bukaKamera}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.konfirmBtnText}>
                  {fotoUri ? "Ambil Ulang" : "Buka Kamera"}
                </Text>
              </TouchableOpacity>

              {fotoBase64 && (
                <TouchableOpacity
                  style={[styles.konfirmasiBtn, submitting && { opacity: 0.7 }]}
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
                      <Text style={styles.konfirmBtnText}>
                        Konfirmasi Absen{" "}
                        {aksiAbsen === "masuk" ? "Masuk" : "Keluar"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.batalBtn}
                onPress={() => setShowKamera(false)}
                disabled={submitting}
              >
                <Text style={styles.batalBtnText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

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
    backgroundColor: "#fff",
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
    color: Colors.textPrimary,
  },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: FontSize.xs - 1, fontFamily: "Poppins_600SemiBold" },
  timesRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  timeBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  timeVal: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: Colors.textPrimary,
  },
  timeEmpty: { color: Colors.textHint },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
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
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  shiftText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: "Poppins_400Regular",
  },

  sumStrip: { flexDirection: "row", gap: 8, marginBottom: 14 },
  sumItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  sumNum: { fontSize: FontSize.xl, fontFamily: "Poppins_700Bold" },
  sumLabel: {
    fontSize: FontSize.xs - 2,
    color: Colors.textTertiary,
    marginTop: 1,
    fontFamily: "Poppins_400Regular",
  },

  sectionHeader: { marginBottom: 10 },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textPrimary,
  },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontFamily: "Poppins_400Regular",
  },

  histItem: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 9,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: { fontSize: 17, fontFamily: "Poppins_700Bold", lineHeight: 20 },
  dateMonth: {
    fontSize: 9,
    textTransform: "uppercase",
    fontFamily: "Poppins_500Medium",
  },
  histInfo: { flex: 1 },
  histName: {
    fontSize: FontSize.sm,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textPrimary,
  },
  chipRow: { flexDirection: "row", gap: 5, marginTop: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  chipText: { fontSize: FontSize.xs - 2, fontFamily: "Poppins_500Medium" },
  chipImg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.primaryXLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  chipImgText: {
    fontSize: FontSize.xs - 2,
    color: Colors.primary,
    fontFamily: "Poppins_500Medium",
  },
  histJam: { fontSize: FontSize.md, fontFamily: "Poppins_700Bold" },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontFamily: "Poppins_700Bold",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  modalSub: {
    fontSize: FontSize.xs,
    fontFamily: "Poppins_400Regular",
    color: Colors.textTertiary,
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
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  mapOverlayText: {
    fontSize: FontSize.sm,
    fontFamily: "Poppins_500Medium",
    color: Colors.primary,
  },

  lokasiInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  lokasiInfoWarning: { backgroundColor: Colors.warningLight },
  lokasiInfoTitle: {
    fontSize: FontSize.sm,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.textPrimary,
  },
  lokasiInfoAddr: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
    fontFamily: "Poppins_400Regular",
  },

  // Kamera
  fotoPreview: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: Colors.background,
  },
  fotoPlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    gap: 8,
  },
  fotoPlaceholderText: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    fontFamily: "Poppins_400Regular",
  },

  modalActions: { gap: 8 },
  konfirmasiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
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
    color: Colors.textTertiary,
  },
});
