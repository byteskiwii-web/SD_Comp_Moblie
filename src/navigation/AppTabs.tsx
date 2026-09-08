import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/home/HomeScreen';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { Icon } from '../components/Icon';
import { colors } from '../theme/tokens';
import { AppTour, hasSeenTour } from '../components/AppTour';

export type AppTabsParamList = {
  Home: undefined;
  Attendance: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

// Filled when focused, outlined when not -- the platform convention on both
// iOS and Android, and it keeps the active tab readable at a glance without
// relying on the tint colour alone.
const ICONS: Record<keyof AppTabsParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  Attendance: ['calendar', 'calendar-outline'],
  Profile: ['person-circle', 'person-circle-outline'],
};

export function AppTabs() {
  // There is no sign-up in this product -- HR creates employees -- so the
  // first time the tabs mount after a sign-in is the only moment that means
  // "new user".
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    void hasSeenTour().then((seen) => setTourOpen(!seen));
  }, []);

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand[700],
        tabBarInactiveTintColor: colors.slate400,
        // Without this every tab falls back to @react-navigation/elements'
        // MissingIcon, which is the literal glyph U+23F7 rendered as text --
        // a solid triangle on iOS, and whatever the system font happens to
        // substitute (possibly tofu) on Android.
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = ICONS[route.name];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="target" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="user" color={color} size={size} /> }}
      />
    </Tab.Navigator>

      <AppTour visible={tourOpen} onClose={() => setTourOpen(false)} />
    </View>
  );
}
