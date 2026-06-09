import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import Colors from '../constants/Colors';
import { FontSize, Radius, Shadow, Spacing } from '../constants/Theme';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertButton {
  text: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

interface AlertModalProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

const CONFIG: Record<AlertType, { icon: string; color: string; bg: string }> = {
  success: { icon: '✅', color: Colors.success, bg: Colors.successLight },
  error:   { icon: '❌', color: Colors.error,   bg: Colors.errorLight },
  warning: { icon: '⚠️', color: Colors.accentDark, bg: Colors.accentLight },
  info:    { icon: 'ℹ️', color: Colors.primary, bg: Colors.primaryXLight },
};

export default function AlertModal({
  visible, type, title, message, buttons, onClose,
}: AlertModalProps) {
  const cfg = CONFIG[type];
  const btns = buttons ?? [{ text: 'Oke', onPress: onClose, variant: 'primary' as const }];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, Shadow.md]}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
            <Text style={styles.icon}>{cfg.icon}</Text>
          </View>
          <Text style={[styles.title, { color: cfg.color }]}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.btnRow}>
            {btns.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  btn.variant === 'secondary' ? styles.btnSecondary : [styles.btnPrimary, { backgroundColor: cfg.color }],
                  btns.length > 1 && styles.btnHalf,
                ]}
                onPress={btn.onPress}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.btnText,
                  btn.variant === 'secondary' ? { color: Colors.textSecondary } : { color: '#fff' },
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  icon: { fontSize: 36 },
  title: {
    fontSize: FontSize.xl,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: FontSize.sm,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnHalf: { flex: 1 },
  btnPrimary: { },
  btnSecondary: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    fontSize: FontSize.md,
    fontFamily: 'Poppins_600SemiBold',
  },
});
