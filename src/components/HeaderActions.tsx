import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import Colors from '../constants/Colors';
import { FontSize } from '../constants/Theme';
import { buildNotifications } from '../services/NotificationService';
import NotificationModal from './NotificationModal';
import ProfileModal from './ProfileModal';

interface Props {
  /** 'hero' = ukuran penuh untuk AbsensiScreen
   *  'compact' = sedikit lebih kecil untuk header standar */
  variant?: 'hero' | 'compact';
}

export default function HeaderActions({ variant = 'compact' }: Props) {
  const { user, logout } = useAuth();
  const [showNotif,   setShowNotif]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const size   = variant === 'hero' ? 34 : 32;
  const radius = size / 2;

  function loadUnread() {
    buildNotifications()
      .then(ns => setUnreadCount(ns.filter(n => !n.dibaca).length))
      .catch(() => {});
  }

  useEffect(() => { loadUnread(); }, []);

  useEffect(() => {
    if (!showNotif) loadUnread();
  }, [showNotif]);

  const firstName = user?.name?.split(' ')[0] ?? '?';
  const avatarUri = user?.images
    ? (user.images.startsWith('data:') ? user.images : `data:image/jpeg;base64,${user.images}`)
    : null;

  return (
    <>
      <View style={styles.row}>
        {/* Notifikasi */}
        <TouchableOpacity
          style={[styles.notifBtn, { width: size, height: size, borderRadius: radius }]}
          onPress={() => setShowNotif(true)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
            size={variant === 'hero' ? 20 : 18}
            color={unreadCount > 0 ? '#fff' : 'rgba(255,255,255,0.65)'}
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Profil */}
        <TouchableOpacity
          style={[
            styles.avatar,
            { width: size, height: size, borderRadius: radius },
            variant === 'compact' && styles.avatarCompact,
          ]}
          onPress={() => setShowProfile(true)}
          activeOpacity={0.75}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: size, height: size, borderRadius: radius }}
            />
          ) : (
            <Text style={[styles.avatarText, variant === 'compact' && styles.avatarTextCompact]}>
              {firstName[0]}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <NotificationModal visible={showNotif}   onClose={() => setShowNotif(false)} />
      <ProfileModal      visible={showProfile} onClose={() => setShowProfile(false)} onLogout={logout} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },

  notifBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },
  badge: {
    position:        'absolute',
    top:             2,
    right:           2,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.accent,
    borderWidth:     1.5,
    borderColor:     Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize:   9,
    fontFamily: 'Poppins_700Bold',
    color:      '#fff',
    lineHeight: 12,
  },

  avatar: {
    backgroundColor: Colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.4)',
    overflow:        'hidden',
  },
  avatarCompact: {
    borderWidth: 1.5,
  },
  avatarText: {
    color:      '#fff',
    fontSize:   FontSize.sm,
    fontFamily: 'Poppins_700Bold',
  },
  avatarTextCompact: {
    fontSize: FontSize.xs,
  },
});
