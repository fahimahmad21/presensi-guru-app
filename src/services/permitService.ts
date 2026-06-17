import apiClient from './apiClient';
import { PermitType, DataTableResponse, PermitHistoryItem, PermitReportItem } from '../types';

export function getPermitTypes() {
  return apiClient.get<{ status: boolean; data: PermitType[] }>('/permit');
}

export function insertPermit(data: {
  permit: number;
  starts: string;
  finish: string;
  info:   string;
  file?:  string;
}) {
  return apiClient.post<{ status: boolean; message: string; data: string }>('/permit', data);
}

export function updatePermit(id: string, data: {
  permit: number;
  starts: string;
  finish: string;
  info:   string;
  file?:  string;
}) {
  return apiClient.put(`/permit/${id}`, data);
}

export function deletePermit(id: string) {
  return apiClient.delete<{ status: boolean; message: string; data: string }>(`/permit/${id}`);
}

export function getPermitHistory(start = 0, length = 20) {
  return apiClient.get<DataTableResponse<PermitHistoryItem>>(`/permit/history?draw=1&start=${start}&length=${length}`);
}

export function getPermitDetail(id: string) {
  return apiClient.get(`/permit/history/${id}`);
}

// /permit/report does not exist on this server — fetch history and expand multi-day permits into daily records
export async function getPermitReport(
  startDate: string, endDate: string,
): Promise<{ data: { status: boolean; data: PermitReportItem[] } }> {
  const histRes = await getPermitHistory(0, 500);
  const items = histRes.data.data ?? [];
  function pad(n: number) { return String(n).padStart(2, '0'); }
  function ds(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  const data: PermitReportItem[] = [];
  for (const item of items) {
    const s = item.starts.split(' ')[0];
    const e = item.finish.split(' ')[0];
    const cur = new Date(s + 'T00:00:00');
    const end = new Date(e + 'T00:00:00');
    while (cur <= end) {
      const d = ds(cur);
      if (d >= startDate && d <= endDate) {
        data.push({
          date:   d,
          permit: item.permittance,
          start:  item.starts.split(' ')[1] ?? '',
          finish: item.finish.split(' ')[1]  ?? '',
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  return { data: { status: true, data } };
}
