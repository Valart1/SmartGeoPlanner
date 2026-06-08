/**
 * MainTabNavigator
 * Bottom tab navigator for the authenticated app:
 * Dashboard | Tasks | Calendar | Map
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../views/dashboard/DashboardScreen';
import TaskListScreen from '../views/tasks/TaskListScreen';
import CalendarScreen from '../views/calendar/CalendarScreen';
import MapScreen from '../views/map/MapScreen';
import { Colors, BorderRadius } from '../theme/theme';
import { PlannerProvider } from '../context/PlannerContext';

export type MainTabParamList = {
  Dashboard: undefined;
  Tasks: undefined;
  Calendar: undefined;
  Map: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  icon: string;
  focused: boolean;
}

function TabIcon({ icon, focused }: TabIconProps) {
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapFocused]}>
      <Text style={[tabStyles.icon, focused && tabStyles.iconFocused]}>{icon}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 30,
    minWidth: 90,
    minHeight: 60,
    borderRadius: BorderRadius.md,
    overflow: 'visible',
  },
  iconWrapFocused: {
    backgroundColor: `${Colors.primary}22`,
  },
  icon: {
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
  },
  iconFocused: {
    transform: [{ scale: 1.05 }],
  },
});

export default function MainTabNavigator() {
  return (
    <PlannerProvider>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 86,
          paddingBottom: 10,
          paddingTop: 10,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskListScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="✅" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📅" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🗺️" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
    </PlannerProvider>
  );
}
