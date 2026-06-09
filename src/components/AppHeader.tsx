import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { FontSize } from '../constants/Theme';

type GradientPoint = { x: number; y: number };

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  colors?: readonly [string, string, ...string[]];
  start?: GradientPoint;
  end?: GradientPoint;
  paddingBottom?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function AppHeader({
  title,
  subtitle,
  right,
  children,
  colors = [Colors.primaryDark, Colors.primary],
  start,
  end,
  paddingBottom = 8,
  style,
  contentStyle,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[
        styles.header,
        { paddingTop: insets.top + 6, paddingBottom },
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>
        {children ?? (
          <View style={styles.row}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {right ? <View style={styles.right}>{right}</View> : null}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  content: {
    minHeight: 42,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: FontSize.md,
    fontFamily: 'Poppins_700Bold',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },
  right: {
    flexShrink: 0,
  },
});
