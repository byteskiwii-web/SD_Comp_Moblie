import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { DayDetailScreen } from '../screens/attendance/DayDetailScreen';
import type { AttendanceStackParamList } from './types';

const Stack = createNativeStackNavigator<AttendanceStackParamList>();

/**
 * Attendance is two screens: the list, and one day in full.
 *
 * Headers are off because both screens draw their own — the day detail needs a
 * centred title between a back chevron and nothing, which the stack header
 * cannot do without fighting it.
 */
export function AttendanceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AttendanceHome" component={AttendanceScreen} />
      <Stack.Screen name="AttendanceDay" component={DayDetailScreen} />
    </Stack.Navigator>
  );
}
