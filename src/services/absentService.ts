import apiClient from './apiClient';
import { AbsentInfo, AbsentCheck, DataTableResponse, AbsentHistoryItem, AbsentReportItem } from '../types';

export function getAbsentInfo() {
  return apiClient.get<{ status: boolean; data: AbsentInfo }>('/absent');
}

export function getAbsentCheck() {
  return apiClient.get<{ status: boolean; data: AbsentCheck }>('/absent/check');
}

export function insertAbsent(lat: number, lng: number, image: string, active: boolean) {
  return apiClient.post<{ status: boolean; message: string; data: string }>('/absent', { lat, lng, image, active });
}

export function getAbsentHistory(start = 0, length = 20) {
  return apiClient.get<DataTableResponse<AbsentHistoryItem>>(`/absent/history?draw=1&start=${start}&length=${length}`);
}

export function getAllAbsentHistory() {
  return apiClient.get<DataTableResponse<AbsentHistoryItem>>('/absent/history?draw=1&start=0&length=500');
}

export function getAbsentDetail(id: string) {
  return apiClient.get(`/absent/history/${id}`);
}

export function getAbsentReport(start: string, finish: string) {
  return apiClient.get<{ status: boolean; data: AbsentReportItem[] }>(`/absent/report?start=${start}&finish=${finish}`);
}
