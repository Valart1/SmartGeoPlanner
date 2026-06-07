/**
 * MapScreen – Location Module View
 * Full-screen map showing task and event pins, current location, and weather.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { useLocationViewModel } from '../../viewmodels/useLocationViewModel';
import { usePlanner } from '../../context/PlannerContext';
import { useFocusEffect } from '@react-navigation/native';
import WeatherWidget from '../components/WeatherWidget';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme/theme';

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

  // Center map on current location
  const centerOnMe = () => {
    if (locVM.currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: locVM.currentLocation.latitude,
        longitude: locVM.currentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 600);
    }
  };

  // Gather all geo-tagged tasks and events
  const taskPins = taskVM.tasks.filter(t => t.location);
  const eventPins = calendarVM.allEvents.filter(e => e.location);

  const initialRegion = locVM.currentLocation
    ? {
        latitude: locVM.currentLocation.latitude,
        longitude: locVM.currentLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : { latitude: 51.505, longitude: -0.09, latitudeDelta: 0.3, longitudeDelta: 0.3 };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Map */}
      {locVM.isLoadingLocation ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Getting your location…</Text>
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
          {/* Task markers */}
          {taskPins.map(task => (
            <Marker
              key={task.id}
              coordinate={{ latitude: task.location!.latitude, longitude: task.location!.longitude }}
              pinColor={task.isCompleted ? Colors.textMuted : Colors.primary}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>📋 {task.title}</Text>
                  {task.dueDate && <Text style={styles.calloutSub}>Due: {task.dueDate}</Text>}
                  <Text style={[styles.calloutBadge, { color: task.isCompleted ? Colors.success : Colors.warning }]}>
                    {task.isCompleted ? '✅ Completed' : '⏳ Pending'}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ))}

          {/* Event markers */}
          {eventPins.map(event => (
            <Marker
              key={event.id}
              coordinate={{ latitude: event.location!.latitude, longitude: event.location!.longitude }}
              pinColor={event.color}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>📅 {event.title}</Text>
                  <Text style={styles.calloutSub}>{event.date} • {event.startTime}–{event.endTime}</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Floating header */}
      <View style={styles.floatingHeader}>
        <Text style={styles.screenTitle}>Map</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.floatingBtn, showWeather && styles.floatingBtnActive]}
            onPress={() => setShowWeather(v => !v)}
            accessibilityLabel="Toggle weather panel"
          >
            <Text>{locVM.weather?.icon ?? '🌡️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingBtn}
            onPress={centerOnMe}
            accessibilityLabel="Center map on my location"
          >
            <Text>📍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Weather panel */}
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

      {/* Bottom legend */}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <Text style={styles.legendItem}>
            <Text style={{ color: Colors.primary }}>● </Text>
            Tasks ({taskPins.length})
          </Text>
          <Text style={styles.legendItem}>
            <Text style={{ color: Colors.event2 }}>● </Text>
            Events ({eventPins.length})
          </Text>
          <Text style={styles.legendItem}>
            <Text style={{ color: Colors.success }}>◉ </Text>
            You
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { color: Colors.textSecondary, fontSize: Typography.fontSize.base },
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Spacing.xxxl, paddingHorizontal: Spacing.base, paddingBottom: Spacing.md,
    backgroundColor: `${Colors.background}CC`,
  },
  screenTitle: { fontSize: Typography.fontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  floatingBtn: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.full,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  floatingBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  weatherPanel: {
    position: 'absolute', top: 110, left: Spacing.base, right: Spacing.base,
  },
  callout: { padding: Spacing.xs, minWidth: 150, gap: 4 },
  calloutTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  calloutSub: { fontSize: 12, color: '#555' },
  calloutBadge: { fontSize: 12, fontWeight: '600' },
  legend: {
    position: 'absolute', bottom: Spacing.xl, left: Spacing.base, right: Spacing.base,
    backgroundColor: `${Colors.card}EE`, borderRadius: BorderRadius.md,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around' },
  legendItem: { fontSize: Typography.fontSize.sm, color: Colors.textSecondary },
});
