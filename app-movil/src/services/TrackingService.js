import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../config';

const LOCATION_TASK_NAME = 'background-location-task';
const LAST_POS_KEY = 'rz_last_sent_pos';

// Helper nativo para calcular distancia (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. Definir la tarea de fondo
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Error en tarea de fondo GPS:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location) {
      await processLocationUpdate(location.coords);
    }
  }
});

async function processLocationUpdate(coords) {
  try {
    const lastPosStr = await AsyncStorage.getItem(LAST_POS_KEY);
    const lastPos = lastPosStr ? JSON.parse(lastPosStr) : null;

    if (lastPos) {
      const distance = getDistance(
        coords.latitude, coords.longitude,
        lastPos.latitude, lastPos.longitude
      );
      if (distance < 5) return;
    }

    const currentStatus = await AsyncStorage.getItem('rz_worker_status') || 'LIBRE';
    const token = await SecureStore.getItemAsync('token');

    if (!token) return;

    const response = await fetch(`${BASE_URL}/api/tracking/posicion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        latitud: coords.latitude,
        longitud: coords.longitude,
        precision_m: coords.accuracy,
        estado_worker: currentStatus
      })
    });

    if (response.ok) {
      await AsyncStorage.setItem(LAST_POS_KEY, JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: Date.now()
      }));
    }
  } catch (err) {
    console.log('Error procesando ubicación radar:', err);
  }
}

export const TrackingService = {
  startTracking: async () => {
    try {
      const { status: foreground } = await Location.requestForegroundPermissionsAsync();
      if (foreground !== 'granted') return false;

      const { status: background } = await Location.requestBackgroundPermissionsAsync();
      if (background !== 'granted') return false;

      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) return true;

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 5,
        deferredUpdatesInterval: 1000 * 60,
        foregroundService: {
          notificationTitle: "InformaTech Radar",
          notificationBody: "Monitoreando tu ruta de trabajo...",
          notificationColor: "#3b82f6"
        }
      });
      return true;
    } catch (e) {
      console.log('Error starting tracking:', e);
      return false;
    }
  },

  stopTracking: async () => {
    try {
      const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (e) {
      console.log('Error stopping tracking:', e);
    }
  },

  setStatus: async (status) => {
    await AsyncStorage.setItem('rz_worker_status', status);
  }
};
