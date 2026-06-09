import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { PayrollItem } from '../../types';
import Colors from '../../constants/Colors';
import { FontSize, Radius, Shadow } from '../../constants/Theme';
import AppHeader from '../../components/AppHeader';
import HeaderActions from '../../components/HeaderActions';
import AlertModal from '../../components/AlertModal';

const GRAY = '#AAAAAA';
type IonName = keyof typeof Ionicons.glyphMap;

const BULAN_PANJANG = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const MOCK_CURRENT: PayrollItem = {
  id: '1', bulan: 'Juni', tahun: 2025,
  gajiPokok: 3500000, tFungsional: 750000, tTransport: 500000, uangMakan: 300000,
  potAbsen: 150000, potBpjs: 50000, totalBersih: 4850000,
  hariHadir: 21, hariKerja: 24, status: 'Dibayar', tanggalBayar: '28 Jun 2025',
};

const MOCK_HISTORY: PayrollItem[] = [
  { id: '2', bulan: 'Mei', tahun: 2025, gajiPokok: 3500000, tFungsional: 750000, tTransport: 500000, uangMakan: 300000, potAbsen: 100000, potBpjs: 50000, totalBersih: 4900000, hariHadir: 22, hariKerja: 24, status: 'Dibayar', tanggalBayar: '28 Mei 2025' },
  { id: '3', bulan: 'April', tahun: 2025, gajiPokok: 3500000, tFungsional: 750000, tTransport: 500000, uangMakan: 300000, potAbsen: 0, potBpjs: 50000, totalBersih: 5000000, hariHadir: 24, hariKerja: 24, status: 'Dibayar', tanggalBayar: '28 Apr 2025' },
];

type NumericKey = 'gajiPokok' | 'tFungsional' | 'tTransport' | 'uangMakan' | 'potAbsen' | 'potBpjs';
type BdownItem = { icon: IonName; label: string; key: NumericKey };

const PEMASUKAN: BdownItem[] = [
  { icon: 'cash-outline',       label: 'Gaji Pokok',           key: 'gajiPokok'   },
  { icon: 'school-outline',     label: 'Tunjangan Fungsional', key: 'tFungsional' },
  { icon: 'car-outline',        label: 'Tunjangan Transport',  key: 'tTransport'  },
  { icon: 'restaurant-outline', label: 'Uang Makan',           key: 'uangMakan'   },
];
const POTONGAN: BdownItem[] = [
  { icon: 'bar-chart-outline', label: 'Potongan Absen', key: 'potAbsen' },
  { icon: 'shield-outline',    label: 'Potongan BPJS',  key: 'potBpjs'  },
];

function rp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function buatHtmlSlip(data: PayrollItem): string {
  const total_masuk  = data.gajiPokok + data.tFungsional + data.tTransport + data.uangMakan;
  const total_potong = data.potAbsen + data.potBpjs;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;padding:32px;color:#212121;font-size:13px}
  h1{color:#1565C0;font-size:20px;margin-bottom:4px}
  .sub{color:#616161;font-size:12px;margin-bottom:24px}
  .sekolah{display:flex;align-items:center;gap:12px;margin-bottom:20px;border-bottom:2px solid #1565C0;padding-bottom:16px}
  .logo{width:56px;height:56px;background:#1565C0;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th{background:#1565C0;color:#fff;padding:10px 14px;text-align:left;font-size:12px}
  td{padding:9px 14px;border-bottom:1px solid #E0E0E0;font-size:12px}
  .plus{color:#2E7D32;font-weight:bold}
  .minus{color:#C62828;font-weight:bold}
  .total-row td{background:#EBF3FD;font-weight:bold;font-size:14px;color:#0D47A1}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
  .info-item{background:#F5F5F5;border-radius:8px;padding:10px 14px}
  .info-label{font-size:10px;color:#9E9E9E;text-transform:uppercase}
  .info-val{font-size:14px;font-weight:bold;color:#212121;margin-top:2px}
  .footer{margin-top:32px;text-align:center;color:#9E9E9E;font-size:11px;border-top:1px solid #E0E0E0;padding-top:16px}
</style></head><body>
<div class="sekolah"><div class="logo">⭐</div><div><h1>Slip Gaji – ${data.bulan} ${data.tahun}</h1><div class="sub">SD BINTANG JUARA · Sistem Presensi Guru</div></div></div>
<div class="info-grid">
  <div class="info-item"><div class="info-label">Nama Guru</div><div class="info-val">Sari Dewi, S.Pd.</div></div>
  <div class="info-item"><div class="info-label">Jabatan</div><div class="info-val">Wali Kelas 4A</div></div>
  <div class="info-item"><div class="info-label">Periode</div><div class="info-val">${data.bulan} ${data.tahun}</div></div>
  <div class="info-item"><div class="info-label">Tanggal Bayar</div><div class="info-val">${data.tanggalBayar ?? '-'}</div></div>
</div>
<table><tr><th colspan="2">Pemasukan</th></tr>
<tr><td>Gaji Pokok</td><td class="plus">${rp(data.gajiPokok)}</td></tr>
<tr><td>Tunjangan Fungsional</td><td class="plus">${rp(data.tFungsional)}</td></tr>
<tr><td>Tunjangan Transport</td><td class="plus">${rp(data.tTransport)}</td></tr>
<tr><td>Uang Makan</td><td class="plus">${rp(data.uangMakan)}</td></tr>
<tr><td><strong>Total Pemasukan</strong></td><td class="plus"><strong>${rp(total_masuk)}</strong></td></tr></table>
<table><tr><th colspan="2">Potongan</th></tr>
<tr><td>Potongan Absen</td><td class="minus">– ${rp(data.potAbsen)}</td></tr>
<tr><td>Potongan BPJS</td><td class="minus">– ${rp(data.potBpjs)}</td></tr>
<tr><td><strong>Total Potongan</strong></td><td class="minus"><strong>– ${rp(total_potong)}</strong></td></tr></table>
<table><tr class="total-row"><td>GAJI BERSIH</td><td style="font-size:16px">${rp(data.totalBersih)}</td></tr></table>
<table><tr><th colspan="2">Dasar Perhitungan</th></tr>
<tr><td>Hari Kerja</td><td>${data.hariKerja} hari</td></tr>
<tr><td>Hadir</td><td style="color:#2E7D32;font-weight:bold">${data.hariHadir} hari</td></tr>
<tr><td>Izin</td><td>2 hari</td></tr><tr><td>Alpha</td><td style="color:#C62828;font-weight:bold">1 hari</td></tr></table>
<div class="footer">Dokumen ini diterbitkan secara digital oleh Sistem Presensi SD Bintang Juara.<br>
Dicetak pada ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
</body></html>`;
}

export default function PayrollScreen() {
  const [bulanIdx, setBulanIdx] = useState(5);
  const [unduhLoading, setUnduhLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, type: 'success' as 'success' | 'error', title: '', msg: '' });
  const data = MOCK_CURRENT;

  const handleUnduhPDF = async () => {
    setUnduhLoading(true);
    try {
      const html = buatHtmlSlip(data);
      const { uri: tmpUri } = await Print.printToFileAsync({ html, base64: false });

      // Pindahkan ke document directory dengan nama bermakna
      const namaFile = `Slip_Gaji_${data.bulan}_${data.tahun}.pdf`;
      const tujuanFile = new File(Paths.document, namaFile);
      const tmpFile = new File(tmpUri);
      tmpFile.move(tujuanFile);

      await Sharing.shareAsync(tujuanFile.uri, {
        mimeType: 'application/pdf',
        dialogTitle: namaFile,
        UTI: 'com.adobe.pdf',
      });
    } catch {
      setAlert({ visible: true, type: 'error', title: 'Gagal Mengunduh', msg: 'Terjadi kesalahan saat membuat slip gaji. Silakan coba lagi.' });
    } finally {
      setUnduhLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Slip Gaji" right={<HeaderActions />} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* NAVIGASI BULAN */}
        <View style={[styles.navRow, Shadow.sm]}>
          <TouchableOpacity style={styles.navBtn} onPress={() => setBulanIdx(i => (i - 1 + 12) % 12)}>
            <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{BULAN_PANJANG[bulanIdx]} 2025</Text>
          <TouchableOpacity style={styles.navBtn} onPress={() => setBulanIdx(i => (i + 1) % 12)}>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* KARTU GAJI BERSIH */}
        <LinearGradient colors={['#0D47A1', '#1565C0', '#90CAF9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.payCard}>
          <Text style={styles.payMonth}>Gaji Bersih — {data.bulan} {data.tahun}</Text>
          <Text style={styles.payAmount}><Text style={styles.payRp}>Rp </Text>{data.totalBersih.toLocaleString('id-ID')}</Text>
          <View style={styles.payStatusRow}>
            <View style={styles.payBadge}>
              <Text style={styles.payBadgeText}>{data.status === 'Dibayar' ? '✓ Sudah Dibayar' : '⏳ Belum Dibayar'}</Text>
            </View>
            <Text style={styles.payDate}>{data.tanggalBayar ?? '-'}</Text>
          </View>
        </LinearGradient>

        {/* RINCIAN GAJI */}
        <View style={[styles.bdownCard, Shadow.sm]}>
          <Text style={styles.bdownTitle}>Rincian Gaji</Text>
          {PEMASUKAN.map(item => (
            <View key={item.key} style={styles.brow}>
              <View style={styles.blbl}>
                <View style={styles.bico}>
                  <Ionicons name={item.icon} size={17} color={GRAY} />
                </View>
                <Text style={styles.blblText}>{item.label}</Text>
              </View>
              <Text style={[styles.bamount, styles.baPlus]}>+ {rp(data[item.key])}</Text>
            </View>
          ))}
          <View style={styles.bdiv} />
          {POTONGAN.map(item => (
            <View key={item.key} style={styles.brow}>
              <View style={styles.blbl}>
                <View style={styles.bico}>
                  <Ionicons name={item.icon} size={17} color={GRAY} />
                </View>
                <Text style={styles.blblText}>{item.label}</Text>
              </View>
              <Text style={[styles.bamount, styles.baMinus]}>− {rp(data[item.key])}</Text>
            </View>
          ))}
          <View style={styles.bdiv} />
          <View style={styles.browTotal}>
            <Text style={styles.blblTotal}>Total Gaji Bersih</Text>
            <Text style={styles.bamountTotal}>{rp(data.totalBersih)}</Text>
          </View>
        </View>

        {/* DASAR PERHITUNGAN */}
        <View style={[styles.bdownCard, Shadow.sm]}>
          <Text style={styles.bdownTitle}>Dasar Perhitungan</Text>
          {[
            { icon: 'calendar-outline' as IonName, label: 'Hari Kerja', val: `${data.hariKerja} Hari`, color: Colors.textPrimary },
            { icon: 'checkmark-circle-outline' as IonName, label: 'Hadir',     val: `${data.hariHadir} Hari`, color: Colors.success },
            { icon: 'document-text-outline' as IonName,    label: 'Izin',      val: '2 Hari',              color: Colors.accentDark },
            { icon: 'close-circle-outline' as IonName,     label: 'Alpha',     val: '1 Hari',              color: Colors.primary },
          ].map(row => (
            <View key={row.label} style={styles.brow}>
              <View style={styles.blbl}>
                <View style={styles.bico}>
                  <Ionicons name={row.icon} size={17} color={GRAY} />
                </View>
                <Text style={styles.blblText}>{row.label}</Text>
              </View>
              <Text style={[styles.basisVal, { color: row.color }]}>{row.val}</Text>
            </View>
          ))}
        </View>

        {/* TOMBOL UNDUH */}
        <TouchableOpacity style={styles.dlBtn} onPress={handleUnduhPDF} disabled={unduhLoading} activeOpacity={0.85}>
          {unduhLoading
            ? <ActivityIndicator color={Colors.primary} />
            : <>
                <Ionicons name="download-outline" size={20} color={Colors.primary} />
                <Text style={styles.dlBtnText}>Unduh Slip Gaji PDF</Text>
              </>
          }
        </TouchableOpacity>

        {/* RIWAYAT */}
        <View style={styles.histSection}>
          <View style={styles.histHeader}>
            <Text style={styles.histTitle}>Riwayat Pembayaran</Text>
            <Text style={styles.seeAll}>Semua</Text>
          </View>
          {MOCK_HISTORY.map(item => (
            <View key={item.id} style={[styles.histItem, Shadow.sm]}>
              <View style={styles.histIco}>
                <Ionicons name="wallet-outline" size={22} color={GRAY} />
              </View>
              <View style={styles.histInfo}>
                <Text style={styles.histMonth}>{item.bulan} {item.tahun}</Text>
                <Text style={styles.histDate}>Dibayar {item.tanggalBayar}</Text>
              </View>
              <Text style={styles.histAmt}>{rp(item.totalBersih)}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <AlertModal
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.msg}
        onClose={() => setAlert(a => ({ ...a, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', margin: 14, borderRadius: 14, padding: 12 },
  navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },

  payCard: { marginHorizontal: 14, borderRadius: 20, padding: 22, marginBottom: 14, overflow: 'hidden' },
  payMonth: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', fontFamily: 'Poppins_400Regular', marginBottom: 4 },
  payAmount: { fontSize: FontSize.xxxl, fontFamily: 'Poppins_700Bold', color: '#fff', letterSpacing: -0.5 },
  payRp: { fontSize: FontSize.lg, fontFamily: 'Poppins_400Regular' },
  payStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  payBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  payBadgeText: { color: '#fff', fontSize: FontSize.xs - 1, fontFamily: 'Poppins_600SemiBold' },
  payDate: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs - 1, fontFamily: 'Poppins_400Regular' },

  bdownCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 14, marginBottom: 12 },
  bdownTitle: { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  brow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.background },
  blbl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bico: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  blblText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: 'Poppins_400Regular' },
  bamount: { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold' },
  baPlus: { color: Colors.success },
  baMinus: { color: Colors.primary },
  bdiv: { borderTopWidth: 2, borderTopColor: Colors.border, borderStyle: 'dashed', marginVertical: 8 },
  browTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingBottom: 4 },
  blblTotal: { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
  bamountTotal: { fontSize: FontSize.lg, fontFamily: 'Poppins_700Bold', color: Colors.primary },
  basisVal: { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold' },

  dlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16, marginHorizontal: 14, marginBottom: 14 },
  dlBtnText: { color: Colors.primary, fontSize: FontSize.md, fontFamily: 'Poppins_700Bold' },

  histSection: { paddingHorizontal: 14 },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  histTitle: { fontSize: FontSize.md, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  seeAll: { fontSize: FontSize.xs - 1, fontFamily: 'Poppins_500Medium', color: Colors.primary },
  histItem: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  histIco: { width: 44, height: 44, backgroundColor: Colors.background, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  histInfo: { flex: 1 },
  histMonth: { fontSize: FontSize.sm, fontFamily: 'Poppins_600SemiBold', color: Colors.textPrimary },
  histDate: { fontSize: FontSize.xs - 1, color: Colors.textTertiary, fontFamily: 'Poppins_400Regular' },
  histAmt: { fontSize: FontSize.md, fontFamily: 'Poppins_700Bold', color: Colors.textPrimary },
});
