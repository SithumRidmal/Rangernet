import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChartColumnIcon, EllipsisIcon, HouseIcon, RouteIcon, UsersIcon } from 'lucide-react-native';
import { RoleTabBar, type TabIconMap } from '@shared/navigation/TabBar';
import { SyncCenterScreen } from '@shared/sync/SyncCenterScreen';
import { ProfileScreen } from '@shared/profile/ProfileScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PatrolsScreen } from '../screens/PatrolsScreen';
import { RangersScreen } from '../screens/RangersScreen';
import { CoverageScreen } from '../screens/CoverageScreen';
import { SupervisorMoreScreen } from '../screens/SupervisorMoreScreen';
import { PatrolDetailScreen } from '../screens/PatrolDetailScreen';
import { PatrolFormScreen } from '../screens/PatrolFormScreen';
import { PatrolSavedScreen } from '../screens/PatrolSavedScreen';
import { RangerDetailScreen } from '../screens/RangerDetailScreen';
import { IncidentsScreen } from '../screens/IncidentsScreen';
import { IncidentDetailScreen } from '../screens/IncidentDetailScreen';
import { SupervisorNotificationsScreen } from '../screens/SupervisorNotificationsScreen';
import type { SupervisorStackParamList, SupervisorTabParamList } from './types';

const Stack = createNativeStackNavigator<SupervisorStackParamList>();
const Tab = createBottomTabNavigator<SupervisorTabParamList>();

const TAB_ICONS: TabIconMap = {
  Dashboard: { label: 'Dashboard', icon: HouseIcon },
  Patrols: { label: 'Patrols', icon: RouteIcon },
  Rangers: { label: 'Rangers', icon: UsersIcon },
  Coverage: { label: 'Coverage', icon: ChartColumnIcon },
  More: { label: 'More', icon: EllipsisIcon },
};

function SupervisorTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <RoleTabBar {...props} icons={TAB_ICONS} />}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Patrols" component={PatrolsScreen} />
      <Tab.Screen name="Rangers" component={RangersScreen} />
      <Tab.Screen name="Coverage" component={CoverageScreen} />
      <Tab.Screen name="More" component={SupervisorMoreScreen} />
    </Tab.Navigator>
  );
}

export function SupervisorNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={SupervisorTabs} />
      <Stack.Screen name="PatrolDetail" component={PatrolDetailScreen} />
      <Stack.Screen name="PatrolForm" component={PatrolFormScreen} />
      <Stack.Screen name="PatrolSaved" component={PatrolSavedScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="RangerDetail" component={RangerDetailScreen} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} />
      <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
      <Stack.Screen name="SyncCenter" component={SyncCenterScreen} />
      <Stack.Screen name="Notifications" component={SupervisorNotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
