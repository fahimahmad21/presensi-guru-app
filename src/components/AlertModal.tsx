import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { ColorPalette } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
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

function getConfig(colors: ColorPalette): Record<AlertType, { icon: string; color: string; bg: string }> {
  return {
    success: { icon: '✅', color: colors.success, bg: colors.successLight },
    error:   { icon: '❌', color: colors.error,   bg: colors.errorLight },
    warning: { icon: '⚠️', color: colors.accentDark, bg: colors.accentLight },
    info:    { icon: 'ℹ️', color: colors.primary, bg: colors.primaryXLight },
  };
}

export default function AlertModal({
  visible, type, title, message, buttons, onClose,
}: AlertModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const CONFIG = React.useMemo(() => getConfig(colors), [colors]);
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
                  btn.variant === 'secondary' ? { color: colors.textSecondary } : { color: '#fff' },
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

const getStyles = (colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.white,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    fontSize: FontSize.md,
    fontFamily: 'Poppins_600SemiBold',
  },
});
