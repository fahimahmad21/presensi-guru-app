import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { MainTabParamList } from "../types";
import Colors from "../constants/Colors";
import AbsensiScreen from "../screens/main/AbsensiScreen";
import IzinScreen from "../screens/main/IzinScreen";
import LaporanScreen from "../screens/main/LaporanScreen";
import PayrollScreen from "../screens/main/PayrollScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

const GRAY = "#AAAAAA";
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
  label,
  focused,
}: {
  iconOn: keyof typeof Ionicons.glyphMap;
  iconOff: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? iconOn : iconOff}
        size={26}
        color={focused ? Colors.primary : GRAY}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
      {focused && <View style={styles.tabDot} />}
    </View>
  );
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();

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
                label={tab.label}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 63,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
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
    gap: 3,
    paddingVertical: 8,
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: GRAY,
  },
  tabLabelActive: {
    fontSize: 12,
    fontFamily: "Poppins_700Bold",
    color: Colors.primary,
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
    marginTop: 1,
  },
});
