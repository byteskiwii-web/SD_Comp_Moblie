import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { FestivalsScreen } from '../screens/festivals/FestivalsScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

/**
 * Home, plus the screens reached from it.
 *
 * Festivals lives here rather than as its own tab: it is something you glance
 * at from the home card a few times a year, not a place you go. A sixth tab
 * would cost every screen bar space permanently for that.
 */
export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Festivals" component={FestivalsScreen} />
    </Stack.Navigator>
  );
}
