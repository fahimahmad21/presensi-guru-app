import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { MainTabParamList } from "../types";
import { ColorPalette } from "../constants/Colors";
import { useTheme } from "../context/ThemeContext";
import AbsensiScreen from "../screens/main/AbsensiScreen";
import IzinScreen from "../screens/main/IzinScreen";
import LaporanScreen from "../screens/main/LaporanScreen";
import PayrollScreen from "../screens/main/PayrollScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS: {
  name: keyof MainTabParamList;
  label: string;
  iconOn: keyof typeof Ionicons.glyphMap;
  iconOff: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    name: "Absensi",
    label: "Absensi",
    iconOn: "home",
    iconOff: "home-outline",
  },
  {
    name: "Izin",
    label: "Izin",
    iconOn: "document-text",
    iconOff: "document-text-outline",
  },
  {
    name: "Laporan",
    label: "Laporan",
    iconOn: "bar-chart",
    iconOff: "bar-chart-outline",
  },
  {
    name: "Payroll",
    label: "Payroll",
    iconOn: "wallet",
    iconOff: "wallet-outline",
  },
];

function TabIcon({
  iconOn,
  iconOff,
  focused,
}: {
  iconOn: keyof typeof Ionicons.glyphMap;
  iconOff: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? iconOn : iconOff}
        size={26}
        color={focused ? colors.primary : colors.textTertiary}
      />
    </View>
  );
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 45 + (insets.bottom || 0) + 6,
            paddingBottom: (insets.bottom || 8) + 6,
          },
        ],
        tabBarShowLabel: false,
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={
            tab.name === "Absensi"
              ? AbsensiScreen
              : tab.name === "Izin"
                ? IzinScreen
                : tab.name === "Laporan"
                  ? LaporanScreen
                  : PayrollScreen
          }
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                iconOn={tab.iconOn}
                iconOff={tab.iconOff}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const getStyles = (colors: ColorPalette) => StyleSheet.create({
  tabBar: {
    height: 63,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    paddingHorizontal: 4,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    minWidth: 64,
  },
});
