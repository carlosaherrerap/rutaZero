import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDistance } from 'geolib'; // Necesitamos instalar geolib o usar nuestra función helper

const LOCATION_TASK_NAME = 'background-location-task';
const LAST_POS_KEY = 'rz_last_sent_pos';

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

    // Calcular distancia si existe una posición previa
    if (lastPos) {
      const distance = getDistance(
        { latitude: coords.latitude, longitude: coords.longitude },
        { latitude: lastPos.latitude, longitude: lastPos.longitude }
      );

      // Si se movió menos de 5 metros, no enviamos nada al servidor
      // (El servidor también lo valida, pero ahorramos datos aquí)
      if (distance < 5) return;
    }

    // Obtener estado actual del worker (guardado en AsyncStorage por las pantallas)
    const currentStatus = await AsyncStorage.getItem('rz_worker_status') || 'LIBRE';
    const token = await AsyncStorage.getItem('userToken'); // Asumiendo que se guarda aquí

    if (!token) return;

    // Enviar al servidor
    const response = await fetch('https://tu-api.com/api/tracking/posicion', {
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
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    if (foreground !== 'granted') return false;

    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    if (background !== 'granted') return false;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 5, // Metros
      deferredUpdatesInterval: 1000 * 60, // 1 minuto
      foregroundService: {
        notificationTitle: "Ruta Zero Radar",
        notificationBody: "Monitoreando tu ruta de trabajo...",
        notificationColor: "#3b82f6"
      }
    });
    return true;
  },

  stopTracking: async () => {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  },

  // Helper para cambiar el estado desde las pantallas
  setStatus: async (status) => {
    await AsyncStorage.setItem('rz_worker_status', status);
  }
};
