import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HomeStack } from './HomeStack';
import { AttendanceStack } from './AttendanceStack';
import { LeaveScreen } from '../screens/leave/LeaveScreen';
import { TeamScreen } from '../screens/team/TeamScreen';
import { useAuthStore } from '../stores/authStore';
import { ProfileStack } from './ProfileStack';
import { Icon } from '../components/Icon';
import { useThemeStore } from '../stores/themeStore';
import { AppTour, hasSeenTour } from '../components/AppTour';
import { TourTargetProvider } from '../components/tour/TourTarget';
import { useTourStore } from '../stores/tourStore';

export type AppTabsParamList = {
  Home: undefined;
  Attendance: undefined;
  Leave: undefined;
  Team: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

// Filled when focused, outlined when not -- the platform convention on both
// iOS and Android, and it keeps the active tab readable at a glance without
// relying on the tint colour alone.
const ICONS: Record<keyof AppTabsParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  Attendance: ['calendar', 'calendar-outline'],
  Leave: ['airplane', 'airplane-outline'],
  Team: ['people', 'people-outline'],
  Profile: ['person-circle', 'person-circle-outline'],
};

export function AppTabs() {
  // The one and only tour instance, mounted above the tabs.
  //
  // It has to live here now that it navigates: an instance inside Profile
  // would unmount the moment it walked somebody to Attendance. The buttons on
  // Home and Profile set the store flag; this renders it.
  // The tab is navigation, not authority -- the server decides what a
  // principal may read, and refuses every write from this role by name. It is
  // shown for team leads only so the panel`s "View only" label stays true: a
  // site manager reading the same screens CAN approve, and telling them
  // otherwise would be worse than not showing it.
  const role = useAuthStore((s) => s.employee?.role);
  const isTeamLead = role === 'team-lead';
  const colors = useThemeStore((s) => s.colors);

  const tourOpen = useTourStore((s) => s.open);
  const startTour = useTourStore((s) => s.start);
  const stopTour = useTourStore((s) => s.stop);

  // There is no sign-up in this product -- HR creates employees -- so the
  // first time the tabs mount after a sign-in is the only moment that means
  // "new user".
  useEffect(() => {
    void hasSeenTour().then((seen) => {
      if (!seen) startTour();
    });
  }, [startTour]);

  return (
    <TourTargetProvider>
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand[700],
        tabBarInactiveTintColor: colors.slate400,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.slate200 },
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
        component={HomeStack}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceStack}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="target" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Leave"
        component={LeaveScreen}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="calendar" color={color} size={size} /> }}
      />
      {isTeamLead && (
        <Tab.Screen
          name="Team"
          component={TeamScreen}
          options={{
            tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarIcon: ({ color, size }) => <Icon name="user" color={color} size={size} /> }}
      />
    </Tab.Navigator>

      <AppTour visible={tourOpen} onClose={stopTour} />
    </View>
    </TourTargetProvider>
  );
}
