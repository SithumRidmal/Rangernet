import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardListIcon, EllipsisIcon, HouseIcon, RouteIcon, SirenIcon } from 'lucide-react-native';
import { RoleTabBar, type TabIconMap } from '@shared/navigation/TabBar';
import { SyncCenterScreen } from '@shared/sync/SyncCenterScreen';
import { ProfileScreen } from '@shared/profile/ProfileScreen';
import { useProfile } from '@shared/auth/AuthProvider';
import { IncidentDraftProvider } from '@features/uc01-incident-reporting/incident/IncidentDraftContext';
import { patrolTracker } from '@features/uc02-patrol-tracking/ranger/services/PatrolTracker';
import { RangerHomeScreen } from '../screens/home/RangerHomeScreen';
import { IncidentTypeScreen } from '@features/uc01-incident-reporting/screens/incident/IncidentTypeScreen';
import { IncidentPhotoScreen } from '@features/uc01-incident-reporting/screens/incident/IncidentPhotoScreen';
import { IncidentLocationScreen } from '@features/uc01-incident-reporting/screens/incident/IncidentLocationScreen';
import { IncidentDescriptionScreen } from '@features/uc01-incident-reporting/screens/incident/IncidentDescriptionScreen';
import { IncidentReviewScreen } from '@features/uc01-incident-reporting/screens/incident/IncidentReviewScreen';
import { IncidentSuccessScreen } from '@features/uc01-incident-reporting/screens/incident/IncidentSuccessScreen';
import { IncidentDetailScreen } from '@features/uc01-incident-reporting/screens/incident/IncidentDetailScreen';
import { MyIncidentsScreen } from '@features/uc01-incident-reporting/screens/incident/MyIncidentsScreen';
import { MyPatrolsScreen } from '@features/uc02-patrol-tracking/ranger/screens/patrol/MyPatrolsScreen';
import { PatrolDetailScreen } from '@features/uc02-patrol-tracking/ranger/screens/patrol/PatrolDetailScreen';
import { ActivePatrolScreen } from '@features/uc02-patrol-tracking/ranger/screens/patrol/ActivePatrolScreen';
import { EndPatrolScreen } from '@features/uc02-patrol-tracking/ranger/screens/patrol/EndPatrolScreen';
import { PatrolSummaryScreen } from '@features/uc02-patrol-tracking/ranger/screens/patrol/PatrolSummaryScreen';
import { ResponsesScreen } from '@features/uc04-human-wildlife-conflict/ranger-response/screens/response/ResponsesScreen';
import { ResponseDetailScreen } from '@features/uc04-human-wildlife-conflict/ranger-response/screens/response/ResponseDetailScreen';
import { RangerMoreScreen, RangerNotificationsScreen } from '../screens/RangerMoreScreen';
import type { RangerStackParamList, RangerTabParamList } from './types';

const Stack = createNativeStackNavigator<RangerStackParamList>();
const Tab = createBottomTabNavigator<RangerTabParamList>();

const TAB_ICONS: TabIconMap = {
  Home: { label: 'Home', icon: HouseIcon },
  Patrols: { label: 'Patrols', icon: RouteIcon },
  Incidents: { label: 'Incidents', icon: ClipboardListIcon },
  Responses: { label: 'Responses', icon: SirenIcon },
  More: { label: 'More', icon: EllipsisIcon },
};

function RangerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <RoleTabBar {...props} icons={TAB_ICONS} />}>
      <Tab.Screen name="Home" component={RangerHomeScreen} />
      <Tab.Screen name="Patrols" component={MyPatrolsScreen} />
      <Tab.Screen name="Incidents" component={MyIncidentsScreen} />
      <Tab.Screen name="Responses" component={ResponsesScreen} />
      <Tab.Screen name="More" component={RangerMoreScreen} />
    </Tab.Navigator>
  );
}

export function RangerNavigator() {
  const profile = useProfile();

  useEffect(() => {
    void patrolTracker.load(profile.id);
    return () => patrolTracker.stop();
  }, [profile.id]);

  return (
    <IncidentDraftProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={RangerTabs} />
        <Stack.Screen name="IncidentType" component={IncidentTypeScreen} />
        <Stack.Screen name="IncidentPhoto" component={IncidentPhotoScreen} />
        <Stack.Screen name="IncidentLocation" component={IncidentLocationScreen} />
        <Stack.Screen name="IncidentDescription" component={IncidentDescriptionScreen} />
        <Stack.Screen name="IncidentReview" component={IncidentReviewScreen} />
        <Stack.Screen name="IncidentSuccess" component={IncidentSuccessScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
        <Stack.Screen name="PatrolDetail" component={PatrolDetailScreen} />
        <Stack.Screen name="ActivePatrol" component={ActivePatrolScreen} />
        <Stack.Screen name="EndPatrol" component={EndPatrolScreen} />
        <Stack.Screen name="PatrolSummary" component={PatrolSummaryScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="ResponseDetail" component={ResponseDetailScreen} />
        <Stack.Screen name="SyncCenter" component={SyncCenterScreen} />
        <Stack.Screen name="Notifications" component={RangerNotificationsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </IncidentDraftProvider>
  );
}
