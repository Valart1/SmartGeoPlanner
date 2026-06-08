/**
 * MapScreen - Location module view.
 * Shows current-user task pins and all locally saved event pins.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { usePlanner } from '../../context/PlannerContext';
import { useLocationViewModel } from '../../viewmodels/useLocationViewModel';
import WeatherWidget from '../components/WeatherWidget';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme/theme';

function taskMarkerDescription(task: {
  description?: string;
  dueDate: string | null;
  dueTime: string | null;
  isCompleted: boolean;
}): string {
  return [
    task.isCompleted ? 'Completed' : 'Pending',
    task.dueDate ? `Due: ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ''}` : null,
    task.description || null,
  ]
    .filter(Boolean)
    .join(' | ');
}

function eventMarkerDescription(event: {
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  isAllDay: boolean;
}): string {
  const timeLabel = event.isAllDay ? 'All day' : `${event.startTime} - ${event.endTime}`;

  return [event.date, timeLabel, event.description || null]
    .filter(Boolean)
    .join(' | ');
}

export default function MapScreen() {
  const locVM = useLocationViewModel();
  const { taskVM, calendarVM } = usePlanner();
  const mapRef = useRef<MapView>(null);
  const [showWeather, setShowWeather] = useState(false);

  useEffect(() => {
    locVM.fetchCurrentLocation();
  }, []);

  useFocusEffect(
    useCallback(() => {
      taskVM.reload();
      calendarVM.reload();
    }, [calendarVM.reload, taskVM.reload]),
  );

  const centerOnMe = () => {
    if (!locVM.currentLocation || !mapRef.current) return;

    mapRef.current.animateToRegion({
      latitude: locVM.currentLocation.latitude,
      longitude: locVM.currentLocation.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 600);
  };

  const taskPins = taskVM.tasks.filter(task => task.location);
  const eventPins = calendarVM.allEvents.filter(event => event.location);

  const initialRegion = locVM.currentLocation
    ? {
        latitude: locVM.currentLocation.latitude,
        longitude: locVM.currentLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : {
        latitude: 51.505,
        longitude: -0.09,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {locVM.isLoadingLocation ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass
        >
          {taskPins.map(task => (
            <Marker
              key={task.id}
              coordinate={{
                latitude: task.location!.latitude,
                longitude: task.location!.longitude,
              }}
              pinColor={task.isCompleted ? Colors.textMuted : Colors.primary}
              title={`Task: ${task.title}`}
              description={taskMarkerDescription(task)}
            />
          ))}

          {eventPins.map(event => (
            <Marker
              key={event.id}
              coordinate={{
                latitude: event.location!.latitude,
                longitude: event.location!.longitude,
              }}
              pinColor={event.color}
              title={`Event: ${event.title}`}
              description={eventMarkerDescription(event)}
            />
          ))}
        </MapView>
      )}

      <View style={styles.floatingHeader}>
        <Text style={styles.screenTitle}>Map</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.floatingBtn, showWeather && styles.floatingBtnActive]}
            onPress={() => setShowWeather(value => !value)}
            accessibilityLabel="Toggle weather panel"
          >
            <Text style={styles.floatingBtnText}>W</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingBtn}
            onPress={centerOnMe}
            accessibilityLabel="Center map on my location"
          >
            <Text style={styles.floatingBtnText}>GPS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showWeather && (
        <View style={styles.weatherPanel}>
          <WeatherWidget
            weather={locVM.weather}
            isLoading={locVM.isLoadingWeather}
            error={locVM.weatherError}
            locationLabel={locVM.locationLabel}
          />
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <Text style={styles.legendItem}>
            <Text style={{ color: Colors.primary }}>Task </Text>
            ({taskPins.length})
          </Text>
          <Text style={styles.legendItem}>
            <Text style={{ color: Colors.event2 }}>Event </Text>
            ({eventPins.length})
          </Text>
          <Text style={styles.legendItem}>
            <Text style={{ color: Colors.success }}>You</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: `${Colors.background}CC`,
  },
  screenTitle: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  floatingBtn: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.full,
    minWidth: 44,
    height: 44,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  floatingBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  floatingBtnText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  weatherPanel: {
    position: 'absolute',
    top: 110,
    left: Spacing.base,
    right: Spacing.base,
  },
  legend: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: `${Colors.card}EE`,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
});
