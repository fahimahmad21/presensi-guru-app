import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import { PermitType, PermitHistoryItem } from "../../types";
import {
  getPermitTypes,
  insertPermit,
  deletePermit,
  getPermitHistory,
} from "../../services/permitService";
import { ColorPalette } from "../../constants/Colors";
import { useTheme } from "../../context/ThemeContext";
import { FontSize, Radius, Shadow } from "../../constants/Theme";
import AppHeader from "../../components/AppHeader";
import HeaderActions from "../../components/HeaderActions";
import AlertModal from "../../components/AlertModal";

type IonName = keyof typeof Ionicons.glyphMap;

// Map ikon berdasarkan nama/mode permit dari API
function getPermitIcon(permit: PermitType): IonName {
  const n = permit.name.toLowerCase();
  if (n.includes("sick") || n.includes("sakit")) return "medkit-outline";
  if (n.includes("picket") || n.includes("piket")) return "clipboard-outline";
  if (permit.mode === "hour") return "time-outline";
  if (permit.mode === "other") return "clipboard-outline";
  return "calendar-outline";
}

// Status history dari API: "Waiting" | "Approved" | "Rejected"
function getActionCfg(
  colors: ColorPalette,
): Record<string, { icon: IonName; color: string; bg: string; label: string }> {
  return {
    Waiting: {
      icon: "time",
      color: colors.statusTerlambat,
      bg: colors.statusTerlambatBg,
      label: "Menunggu",
    },
    Approved: {
      icon: "checkmark-circle",
      color: colors.statusHadir,
      bg: colors.statusHadirBg,
      label: "Disetujui",
    },
    Rejected: {
      icon: "close-circle",
      color: colors.statusAlpha,
      bg: colors.statusAlphaBg,
      label: "Ditolak",
    },
  };
}

// Format "2026-05-11 14:30" → { tgl, bln, jam }
function parseHistDate(dateStr: string) {
  const [datePart, timePart] = dateStr.split(" ");
  const d = new Date(datePart + "T00:00:00");
  return {
    tgl: String(d.getDate()).padStart(2, "0"),
    bln: d.toLocaleDateString("id-ID", { month: "short" }),
    jam: timePart?.slice(0, 5) ?? "",
  };
}

// Format Date → "YYYY-MM-DD HH:MM" untuk API
function toApiDateTime(date: Date, time: Date): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const t = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
  return `${d} ${t}`;
}

function toApiDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fmtTgl(d: Date) {
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function fmt(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3600000);
}

function isPicketPermit(permit: PermitType): boolean {
  const n = permit.name.toLowerCase();
  return n.includes("pagi") || n.includes("sore") || n.includes("koordinator");
}

export default function IzinScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const ACTION_CFG = React.useMemo(() => getActionCfg(colors), [colors]);

  const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
  const [selectedPermit, setSelectedPermit] = useState<PermitType | null>(null);
  const [history, setHistory] = useState<PermitHistoryItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [keterangan, setKeterangan] = useState("");
  const [tanggal, setTanggal] = useState(new Date());
  const [waktuMulai, setWaktuMulai] = useState(new Date());
  const [waktuAkhir, setWaktuAkhir] = useState(addHours(new Date(), 2));

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker1, setShowTimePicker1] = useState(false);
  const [showTimePicker2, setShowTimePicker2] = useState(false);

  const [lampiran, setLampiran] = useState<{
    name: string;
    type: string;
    size: string;
    data: string;
  } | null>(null);
  const [lampiranMode, setLampiranMode] = useState<"file" | "url">("file");
  const [lampiranUrl, setLampiranUrl] = useState("");

  const [alert, setAlert] = useState({
    visible: false,
    type: "success" as "success" | "warning" | "error",
    title: "",
    msg: "",
  });
  const [alertHapus, setAlertHapus] = useState({ visible: false, id: "" });

  const loadData = useCallback(async () => {
    try {
      const [typesRes, histRes] = await Promise.all([
        getPermitTypes(),
        getPermitHistory(),
      ]);
      if (typesRes.data.status && typesRes.data.data.length > 0) {
        const types = typesRes.data.data;
        setPermitTypes(types);
        setSelectedPermit(types.find((p) => !isPicketPermit(p)) ?? types[0]);
      }
      setHistory(histRes.data.data ?? []);
    } catch {
      // screen tetap tampil
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Derived dari selectedPermit
  const isHourMode =
    selectedPermit?.mode === "hour" || selectedPermit?.mode === "other";
  const isDayMode = selectedPermit?.mode === "day";
  const needsFile = !!selectedPermit?.attachment;
  const izinTypes = React.useMemo(
    () => permitTypes.filter((p) => !isPicketPermit(p)),
    [permitTypes],
  );
  const picketTypes = React.useMemo(
    () => permitTypes.filter(isPicketPermit),
    [permitTypes],
  );

  const onDateChange = (_: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (d) setTanggal(d);
  };
  const onTime1Change = (_: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") setShowTimePicker1(false);
    if (d) {
      setWaktuMulai(d);
      setWaktuAkhir(addHours(d, 2));
    }
  };
  const onTime2Change = (_: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === "android") setShowTimePicker2(false);
    if (d) setWaktuAkhir(d);
  };

  const handlePilihPermit = (p: PermitType) => {
    setSelectedPermit(p);
    if (!p.attachment) {
      setLampiran(null);
      setLampiranUrl("");
    }
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const data = await readAsStringAsync(asset.uri, {
          encoding: EncodingType.Base64,
        });
        setLampiran({
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream",
          size: String(asset.size ?? 0),
          data,
        });
        setAlert({
          visible: true,
          type: "success",
          title: "Lampiran Ditambahkan",
          msg: `"${asset.name}" berhasil dipilih.`,
        });
      }
    } catch {
      setAlert({
        visible: true,
        type: "warning",
        title: "Gagal",
        msg: "Tidak dapat membuka pemilih file.",
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedPermit) return;
    if (!keterangan.trim()) {
      setAlert({
        visible: true,
        type: "warning",
        title: "Keterangan Kosong",
        msg: "Silakan isi keterangan izin.",
      });
      return;
    }
    const hasLampiran =
      lampiranMode === "file" ? !!lampiran : !!lampiranUrl.trim();
    if (needsFile && !hasLampiran) {
      setAlert({
        visible: true,
        type: "warning",
        title: "Lampiran Wajib",
        msg: lampiranMode === "url"
          ? "Masukkan URL lampiran yang valid."
          : "Jenis izin ini memerlukan lampiran dokumen.",
      });
      return;
    }

    const dateStr = toApiDate(tanggal);
    const starts = isHourMode
      ? toApiDateTime(tanggal, waktuMulai)
      : `${dateStr} 00:00`;
    const finish = isHourMode
      ? toApiDateTime(tanggal, waktuAkhir)
      : `${dateStr} 23:59`;

    setSubmitting(true);
    try {
      const res = await insertPermit({
        permit: parseInt(selectedPermit.id),
        starts,
        finish,
        info: keterangan.trim(),
        ...(lampiranMode === "file" && lampiran
          ? { file: JSON.stringify(lampiran) }
          : lampiranMode === "url" && lampiranUrl.trim()
          ? { file: lampiranUrl.trim() }
          : {}),
      });
      if (res.data.status) {
        setKeterangan("");
        setLampiran(null);
        setLampiranUrl("");
        await loadData();
        setAlert({
          visible: true,
          type: "success",
          title: "Pengajuan Terkirim",
          msg: "Izin Anda sedang menunggu persetujuan.",
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

  const handleHapus = async () => {
    const id = alertHapus.id;
    setAlertHapus({ visible: false, id: "" });
    try {
      const res = await deletePermit(id);
      if (res.data?.status) {
        setHistory((h) => h.filter((i) => i.id !== id));
        setAlert({
          visible: true,
          type: "success",
          title: "Dihapus",
          msg: "Pengajuan izin berhasil dihapus.",
        });
      } else {
        setAlert({
          visible: true,
          type: "error",
          title: "Gagal",
          msg: res.data?.message ?? "Gagal menghapus izin.",
        });
      }
    } catch (e: any) {
      setAlert({
        visible: true,
        type: "error",
        title: "Gagal",
        msg: e?.response?.data?.message ?? "Gagal menghapus izin.",
      });
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Pengajuan Izin" right={<HeaderActions />} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {loadingInit ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.body}>
            {/* ── JENIS IZIN ── */}
            <Text style={styles.label}>JENIS IZIN</Text>
            <View style={styles.typeGrid}>
              {izinTypes.map((p) => {
                const aktif = selectedPermit?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.typeChip, aktif && styles.typeChipSel]}
                    onPress={() => handlePilihPermit(p)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={getPermitIcon(p)}
                      size={24}
                      color={aktif ? colors.primary : "#AAAAAA"}
                    />
                    <Text
                      style={[styles.typeName, aktif && styles.typeNameSel]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {picketTypes.length > 0 && (
              <>
                <Text style={styles.label}>JENIS PIKET</Text>
                <View style={styles.typeGrid}>
                  {picketTypes.map((p) => {
                    const aktif = selectedPermit?.id === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.typeChip, aktif && styles.typeChipSel]}
                        onPress={() => handlePilihPermit(p)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={getPermitIcon(p)}
                          size={24}
                          color={aktif ? colors.primary : "#AAAAAA"}
                        />
                        <Text
                          style={[styles.typeName, aktif && styles.typeNameSel]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── TANGGAL ── */}
            <Text style={styles.label}>TANGGAL</Text>
            <TouchableOpacity
              style={[styles.inputWrap, { marginBottom: 14 }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color="#AAAAAA"
                style={styles.inputIcon}
              />
              <Text style={[styles.inputText, { flex: 1 }]}>
                {fmtTgl(tanggal)}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#AAAAAA" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={tanggal}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={onDateChange}
              />
            )}

            {/* ── WAKTU berdasarkan mode ── */}
            {isHourMode && (
              <>
                <Text style={styles.label}>RENTANG WAKTU</Text>
                <View style={styles.fRow}>
                  <View style={styles.fHalf}>
                    <Text style={styles.labelSub}>Dari Jam</Text>
                    <TouchableOpacity
                      style={styles.inputWrap}
                      onPress={() => setShowTimePicker1(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color="#AAAAAA"
                        style={styles.inputIcon}
                      />
                      <Text style={[styles.inputText, { flex: 1 }]}>
                        {fmt(waktuMulai)}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#AAAAAA" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.fHalf}>
                    <Text style={styles.labelSub}>Sampai Jam</Text>
                    <TouchableOpacity
                      style={styles.inputWrap}
                      onPress={() => setShowTimePicker2(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color="#AAAAAA"
                        style={styles.inputIcon}
                      />
                      <Text style={[styles.inputText, { flex: 1 }]}>
                        {fmt(waktuAkhir)}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#AAAAAA" />
                    </TouchableOpacity>
                  </View>
                </View>
                {showTimePicker1 && (
                  <DateTimePicker
                    value={waktuMulai}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onTime1Change}
                    is24Hour
                  />
                )}
                {showTimePicker2 && (
                  <DateTimePicker
                    value={waktuAkhir}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onTime2Change}
                    is24Hour
                  />
                )}
              </>
            )}

            {isDayMode && (
              <View style={styles.fullDayBadge}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.statusIzin}
                />
                <Text style={styles.fullDayText}>Izin Seharian Penuh</Text>
              </View>
            )}

            {/* ── KETERANGAN ── */}
            <Text style={styles.label}>KETERANGAN</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Tulis keterangan izin Anda di sini..."
              placeholderTextColor={colors.textHint}
              value={keterangan}
              onChangeText={setKeterangan}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* ── LAMPIRAN — selalu tampil, wajib jika attachment:true ── */}
            <Text style={styles.label}>
              LAMPIRAN{" "}
              {needsFile ? (
                <Text style={styles.labelWajib}>*WAJIB</Text>
              ) : (
                <Text style={styles.labelOpsional}>(opsional)</Text>
              )}
            </Text>

            {/* Toggle File / URL */}
            <View style={styles.lampiranToggle}>
              <TouchableOpacity
                style={[
                  styles.lampiranToggleBtn,
                  lampiranMode === "file" && styles.lampiranToggleBtnActive,
                ]}
                onPress={() => setLampiranMode("file")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="document-attach-outline"
                  size={14}
                  color={lampiranMode === "file" ? "#fff" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.lampiranToggleText,
                    lampiranMode === "file" && styles.lampiranToggleTextActive,
                  ]}
                >
                  Upload File
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.lampiranToggleBtn,
                  lampiranMode === "url" && styles.lampiranToggleBtnActive,
                ]}
                onPress={() => setLampiranMode("url")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="link-outline"
                  size={14}
                  color={lampiranMode === "url" ? "#fff" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.lampiranToggleText,
                    lampiranMode === "url" && styles.lampiranToggleTextActive,
                  ]}
                >
                  Tautan URL
                </Text>
              </TouchableOpacity>
            </View>

            {lampiranMode === "file" ? (
              <TouchableOpacity
                style={[styles.uploadBox, lampiran && styles.uploadBoxFilled]}
                onPress={handleUpload}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={lampiran ? "document-attach" : "attach-outline"}
                  size={28}
                  color={lampiran ? colors.primary : "#AAAAAA"}
                />
                <Text
                  style={[
                    styles.uploadText,
                    lampiran && { color: colors.primary },
                  ]}
                >
                  {lampiran?.name ?? "Upload dokumen pendukung"}
                </Text>
                <Text style={styles.uploadSub}>
                  {lampiran ? "Ketuk untuk mengganti" : "Surat dokter, foto, PDF"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={styles.urlInput}
                placeholder="https://drive.google.com/..."
                placeholderTextColor={colors.textHint}
                value={lampiranUrl}
                onChangeText={setLampiranUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGrad}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Ajukan Izin</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── RIWAYAT ── */}
        <View style={styles.histHeader}>
          <Text style={styles.sectionTitle}>Riwayat Izin</Text>
        </View>
        <View style={styles.histList}>
          {history.length === 0 ? (
            <View style={[styles.emptyBox, Shadow.sm]}>
              <Ionicons
                name="document-outline"
                size={36}
                color={colors.textHint}
              />
              <Text style={styles.emptyText}>Belum ada riwayat izin</Text>
            </View>
          ) : (
            history.map((item) => {
              const ac = ACTION_CFG[item.action] ?? ACTION_CFG.Waiting;
              const { tgl, bln, jam } = parseHistDate(item.starts);
              const { jam: jamAkhir } = parseHistDate(item.finish);
              return (
                <View key={item.id} style={[styles.izinItem, Shadow.sm]}>
                  <View style={[styles.izinIco, { backgroundColor: ac.bg }]}>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={ac.color}
                    />
                  </View>
                  <View style={styles.izinDet}>
                    <Text style={styles.izinType}>{item.permittance}</Text>
                    <Text style={styles.izinDate}>
                      {tgl} {bln}
                      {item.action !== "Waiting" ? "" : ""}
                      {jam ? `  ·  ${jam}–${jamAkhir}` : "  ·  Seharian"}
                    </Text>
                    <View style={styles.chipRow}>
                      <View style={[styles.chip, { backgroundColor: ac.bg }]}>
                        <Text style={[styles.chipText, { color: ac.color }]}>
                          {ac.label}
                        </Text>
                      </View>
                      {item.attachment && (
                        <View style={styles.chipLamp}>
                          <Ionicons
                            name="document-attach-outline"
                            size={10}
                            color={colors.primary}
                          />
                          <Text style={styles.chipLampText}>Lampiran</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: "center", gap: 6 }}>
                    <Ionicons name={ac.icon} size={22} color={ac.color} />
                    {item.action === "Waiting" && (
                      <TouchableOpacity
                        onPress={() =>
                          setAlertHapus({ visible: true, id: item.id })
                        }
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.msg}
        onClose={() => setAlert((a) => ({ ...a, visible: false }))}
      />

      <AlertModal
        visible={alertHapus.visible}
        type="warning"
        title="Hapus Pengajuan Izin?"
        message="Pengajuan izin ini akan dihapus permanen dan tidak dapat dikembalikan."
        buttons={[
          {
            text: "Batal",
            onPress: () => setAlertHapus({ visible: false, id: "" }),
            variant: "secondary",
          },
          { text: "Hapus", onPress: handleHapus },
        ]}
        onClose={() => setAlertHapus({ visible: false, id: "" })}
      />
    </View>
  );
}

const getStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    loadingBox: { flex: 1, padding: 40, alignItems: "center" },
    body: { padding: 14 },

    label: {
      fontSize: 11,
      fontFamily: "Poppins_600SemiBold",
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 4,
    },
    labelSub: {
      fontSize: 11,
      fontFamily: "Poppins_500Medium",
      color: colors.textTertiary,
      marginBottom: 6,
    },
    labelWajib: { color: colors.error, fontSize: 10 },
    labelOpsional: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: "Poppins_400Regular",
    },

    typeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
      marginBottom: 16,
    },
    typeChip: {
      width: "30.5%",
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: "center",
      gap: 5,
    },
    typeChipSel: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryXLight,
    },
    typeName: {
      fontSize: FontSize.xs - 1,
      fontFamily: "Poppins_600SemiBold",
      color: colors.textTertiary,
      textAlign: "center",
    },
    typeNameSel: { color: colors.primary },

    fRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
    fHalf: { flex: 1 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: { marginRight: 6 },
    inputText: {
      fontSize: FontSize.xs,
      fontFamily: "Poppins_400Regular",
      color: colors.textPrimary,
    },

    fullDayBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.statusIzinBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 14,
    },
    fullDayText: {
      fontSize: FontSize.sm,
      fontFamily: "Poppins_600SemiBold",
      color: colors.statusIzin,
    },

    textarea: {
      backgroundColor: colors.background,
      borderRadius: Radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 14,
      fontSize: FontSize.sm,
      fontFamily: "Poppins_400Regular",
      color: colors.textPrimary,
      height: 80,
      marginBottom: 14,
    },

    uploadBox: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: Radius.md,
      padding: 18,
      alignItems: "center",
      marginBottom: 16,
      gap: 5,
    },
    uploadBoxFilled: {
      borderColor: colors.primary,
      borderStyle: "solid",
      backgroundColor: colors.primaryXLight,
    },
    uploadText: {
      fontSize: FontSize.sm,
      color: colors.textSecondary,
      fontFamily: "Poppins_500Medium",
    },
    uploadSub: {
      fontSize: FontSize.xs - 1,
      color: colors.textHint,
      fontFamily: "Poppins_400Regular",
    },

    submitBtn: { borderRadius: Radius.md, overflow: "hidden", marginBottom: 4 },
    submitGrad: { paddingVertical: 16, alignItems: "center" },
    submitText: {
      color: "#fff",
      fontSize: FontSize.md,
      fontFamily: "Poppins_600SemiBold",
    },

    histHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingBottom: 10,
      paddingTop: 6,
    },
    sectionTitle: {
      fontSize: FontSize.md,
      fontFamily: "Poppins_600SemiBold",
      color: colors.textPrimary,
    },

    emptyBox: {
      backgroundColor: colors.white,
      borderRadius: 14,
      marginHorizontal: 14,
      padding: 28,
      alignItems: "center",
      gap: 10,
    },
    emptyText: {
      fontSize: FontSize.sm,
      color: colors.textTertiary,
      fontFamily: "Poppins_400Regular",
    },

    histList: { paddingHorizontal: 14 },
    izinItem: {
      backgroundColor: colors.white,
      borderRadius: 14,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
    },
    izinIco: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    izinDet: { flex: 1 },
    izinType: {
      fontSize: FontSize.sm,
      fontFamily: "Poppins_600SemiBold",
      color: colors.textPrimary,
    },
    izinDate: {
      fontSize: FontSize.xs - 1,
      color: colors.textTertiary,
      fontFamily: "Poppins_400Regular",
      marginTop: 3,
    },
    chipRow: { flexDirection: "row", gap: 5, marginTop: 5, flexWrap: "wrap" },
    chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    chipText: { fontSize: FontSize.xs - 2, fontFamily: "Poppins_500Medium" },
    chipLamp: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.primaryXLight,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 20,
    },
    chipLampText: {
      fontSize: FontSize.xs - 2,
      color: colors.primary,
      fontFamily: "Poppins_400Regular",
    },
    lampiranToggle: {
      flexDirection: "row",
      backgroundColor: colors.white,
      borderRadius: Radius.md,
      padding: 3,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lampiranToggleBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: Radius.md - 2,
    },
    lampiranToggleBtnActive: {
      backgroundColor: colors.primary,
    },
    lampiranToggleText: {
      fontSize: FontSize.sm,
      fontFamily: "Poppins_500Medium",
      color: colors.textSecondary,
    },
    lampiranToggleTextActive: {
      color: "#fff",
    },
    urlInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: FontSize.sm,
      fontFamily: "Poppins_400Regular",
      color: colors.textPrimary,
      backgroundColor: colors.white,
      marginBottom: 16,
    },
  });
