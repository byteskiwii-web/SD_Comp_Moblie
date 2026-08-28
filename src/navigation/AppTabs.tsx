import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/home/HomeScreen';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { colors } from '../theme/tokens';

export type AppTabsParamList = {
  Home: undefined;
  Attendance: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[700],
        tabBarInactiveTintColor: colors.slate400,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
