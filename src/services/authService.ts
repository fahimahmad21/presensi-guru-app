import apiClient from './apiClient';
import { CountryItem } from '../types';

export interface LoginResponse {
  status:  boolean;
  message: string;
  data: {
    name:          string;
    'Auth-Api':    string;
    'Auth-Key':    string;
    'Auth-Token':  string;
    'Auth-Socket': string;
  };
}

export interface ProfileResponse {
  status:  boolean;
  message: string;
  data: {
    country:  number;
    code:     string;
    name:     string;
    email:    string;
    phone:    number;
    gender:   string;
    place:    string | null;
    birthday: string | null;
    address:  string;
    images:   string; // Base64
  };
}

export interface ForgotResponse {
  status:  boolean;
  message: string;
  data: {
    otp:   string;
    code:  string;
    token: string;
  };
}

export function login(username: string, password: string) {
  return apiClient.post<LoginResponse>('/auth/signin', { username, password });
}

export function getProfile() {
  return apiClient.get<ProfileResponse>('/auth');
}

export function updateProfile(data: {
  name?: string; email?: string; phone?: number | string;
  place?: string; gender?: string; country?: number;
  birthday?: string; address?: string;
}) {
  return apiClient.put('/auth', data);
}

export function updateAvatar(image: string) {
  return apiClient.put('/auth/avatar', { image });
}

export function updatePassword(password: string, npassword: string, rpassword: string) {
  return apiClient.put('/auth/password', { password, npassword, rpassword });
}

export function getCountries() {
  return apiClient.get<{ status: boolean; data: CountryItem[] }>('/country');
}

export function forgotPassword(email: string, captcha: string = '') {
  return apiClient.post<ForgotResponse>('/auth/forgot', { email, captcha });
}

export function resetPasswordWithOtp(otp: string, token: string, password: string) {
  return apiClient.put('/auth/forgot', { otp, token, password });
}

export function resetPasswordWithCode(code: string, token: string, password: string) {
  return apiClient.put('/auth/forgot', { code, token, password });
}
