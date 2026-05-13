import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, Dimensions, ScrollView, Linking, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary, saveCrashLog } from '../services/CrashLogService';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as NavigationBar from 'expo-navigation-bar';

const { width } = Dimensions.get('window');

// Helper para calcular distancia entre dos puntos (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en metros
}

const ESTADOS_GESTIONADOS = ['VISITADO_PAGO', 'REPROGRAMADO'];

const DetalleClienteScreen = ({ route, navigation }) => {
  const { cliente: initialCliente } = route.params || {};
  const { api, user } = useContext(AuthContext);
  const [cliente, setCliente] = useState(initialCliente);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Alternar pantalla completa
  const toggleFullscreen = () => {
    setIsMapFullscreen(!isMapFullscreen);
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync(isMapFullscreen ? 'visible' : 'hidden');
    }
  };

  // 1. Cargar datos frescos del cliente al montar para asegurar estado actual y bloqueo
  const fetchClientDetails = useCallback(async () => {
    try {
      // CORRECCIÓN: Usar /api/clientes/ en lugar de /api/workers/clientes/
      const res = await api.get(`/api/clientes/${initialCliente.id || initialCliente.cliente_id}`);
      setCliente(res.data.data);
    } catch (e) {
      console.log('Error fetching client fresh data:', e);
    }
  }, [initialCliente, api]);

  useEffect(() => {
    fetchClientDetails();
    
    // LOG DE MONITOREO: Apertura de detalle
    const logOpen = async () => {
      try {
        const loc = await Location.getLastKnownPositionAsync();
        api.post('/api/monitoreo/log', {
          accion: 'FICHA_DETALLE_ABIERTA',
          cliente_id: initialCliente.id || initialCliente.cliente_id,
          metadata: { lat: loc?.coords.latitude, lng: loc?.coords.longitude }
        }).catch(() => {});
      } catch (e) {}
    };
    logOpen();
  }, [fetchClientDetails]);

  // 2. Obtener ubicación actual y trazar ruta inicial
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Configuración inmersiva total para ocultar barra inferior
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);

  useEffect(() => {
    const { addEventListener } = require('@react-native-community/netinfo');
    const unsubscribe = addEventListener(state => {
      setIsOnline(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
      
      if (cliente) {
        calculateOSRMRoute(location.coords, {
          latitude: parseFloat(cliente.latitud),
          longitude: parseFloat(cliente.longitud)
        });
      }
    })();
  }, [cliente?.id]);

  const calculateOSRMRoute = async (start, end) => {
    setCalculatingRoute(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const formatted = data.routes[0].geometry.coordinates.map(c => ({
          latitude: c[1],
          longitude: c[0]
        }));
        setRouteCoords(formatted);
      }
    } catch (e) {
      console.log('Error OSRM:', e);
    } finally {
      setCalculatingRoute(false);
    }
  };

  if (!cliente) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 10 }}>Cargando información...</Text>
      </View>
    );
  }

  // Lógica de estados con comparación robusta de IDs (string vs number)
  const isOwner = String(cliente.bloqueado_por) === String(user.id);
  const isEnVisita = cliente.estado === 'EN_VISITA';
  const isLockedByOther = isEnVisita && !isOwner;

  const getStatusInfo = (estado) => {
    switch (estado) {
      case 'EN_VISITA': return { color: '#a855f7', label: 'EN CAMINO' };
      case 'VISITADO_PAGO': return { color: '#10b981', label: 'GESTIONADO' };
      case 'REPROGRAMADO': return { color: '#f59e0b', label: 'REPROGRAMADO' };
      default: return { color: '#3b82f6', label: 'LIBRE' };
    }
  };

  const statusInfo = getStatusInfo(cliente.estado);

  const handleStartVisit = async () => {
    setLoading(true);
    const { updateLocalClientStatus } = require('../services/OfflineService');
    try {
      if (!isOnline) {
        console.log('📵 [Visit] Iniciando visita en modo OFFLINE');
        await updateLocalClientStatus(cliente.id, 'EN_VISITA');
        setCliente(prev => ({ ...prev, estado: 'EN_VISITA', bloqueado_por: user.id }));
        Alert.alert('Modo Offline', 'Visita iniciada localmente. Podrás llenar la ficha ahora.');
        setLoading(false);
        return;
      }

      await api.post(`/api/workers/clientes/${cliente.id}/visitar`);
      
      // LOG DE MONITOREO (Dato 1)
      api.post('/api/monitoreo/log', { 
        accion: 'VISITAR_PRESIONADO', 
        cliente_id: cliente.id,
        metadata: { lat: userLocation?.latitude, lng: userLocation?.longitude }
      }).catch(e => console.log('Error logging monitor action'));

      // Sincronizar localmente para que persista si se va el internet
      await updateLocalClientStatus(cliente.id, 'EN_VISITA');
      
      setCliente(prev => ({ ...prev, estado: 'EN_VISITA', bloqueado_por: user.id }));
      Alert.alert('Éxito', 'Visita iniciada. El cliente ahora está EN CAMINO.');
    } catch (err) {
      console.log('❌ [Visit] Error al iniciar visita:', err.message);
      const msg = err.response?.data?.error || 'No se pudo iniciar la visita';
      Alert.alert('Aviso', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToFicha = () => {
    // Validación de distancia eliminada para mayor flexibilidad operativa
    navigation.navigate('FichaForm', { cliente });
  };

  const handleReleaseVisit = async () => {
    const { updateLocalClientStatus } = require('../services/OfflineService');
    Alert.alert(
      'Cancelar Visita',
      '¿Deseas cancelar el camino hacia este cliente y liberarlo?',
      [
        { text: 'No, continuar', style: 'cancel' },
        { 
          text: 'Sí, CANCELAR', 
          onPress: async () => {
            setLoading(true);
            try {
              if (isOnline) {
                await api.patch(`/api/workers/clientes/${cliente.id}/liberar`);
              } else {
                console.log('📵 [Release] Liberando localmente (OFFLINE)');
              }

              // Sincronizar localmente siempre
              await updateLocalClientStatus(cliente.id, 'LIBRE');
              
              setCliente(prev => ({ ...prev, estado: 'LIBRE', bloqueado_por: null }));
              Alert.alert(isOnline ? 'Liberado' : 'Modo Offline', 'Visita cancelada con éxito.');
            } catch (err) {
              Alert.alert('Error', 'No se pudo liberar.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const openExternalMaps = () => {
    const lat = cliente.latitud;
    const lon = cliente.longitud;
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lon}`,
      android: `geo:0,0?q=${lat},${lon}(${cliente.nombres})`
    });
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        scrollEnabled={!isMapFullscreen}
      >
        <View style={[styles.mapContainer, isMapFullscreen && styles.mapFullscreen]}>
          {cliente.latitud ? (
            <>
              <WebView
                style={{ flex: 1 }}
                originWhitelist={['*']}
                source={{ html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
                    <style>
                      html, body, #map { height: 100%; margin: 0; padding: 0; background: #1e293b; touch-action: none; }
                      .recenter-btn {
                        position: fixed; bottom: 20px; right: 20px; z-index: 1000;
                        background: white; width: 40px; height: 40px; border-radius: 8px;
                        display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                      }
                    </style>
                  </head>
                  <body>
                    <div id="map"></div>
                    <div class="recenter-btn" onclick="recenter()">📍</div>
                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                    <script>
                      var lat = ${parseFloat(cliente.latitud)};
                      var lng = ${parseFloat(cliente.longitud)};
                      var map = L.map('map', { zoomControl: false }).setView([lat, lng], 17);
                      
                      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '© OSM'
                      }).addTo(map);

                      L.control.zoom({ position: 'topright' }).addTo(map);

                      var clientIcon = L.divIcon({
                        html: '<div style="background:#3b82f6;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.5)"></div>',
                        iconSize: [24, 24], iconAnchor: [12, 12]
                      });

                      L.marker([lat, lng], {icon: clientIcon}).addTo(map)
                        .bindPopup("<b>${(cliente.nombres || '').replace(/"/g, '')}</b>")
                        .openPopup();

                      ${userLocation ? `
                        var workerIcon = L.divIcon({
                          html: '<div style="background:#10b981;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.5)"></div>',
                          iconSize: [18, 18], iconAnchor: [9, 9]
                        });
                        L.marker([${userLocation.latitude}, ${userLocation.longitude}], {icon: workerIcon}).addTo(map);
                      ` : ''}

                      function recenter() {
                        map.setView([lat, lng], 17);
                      }
                    </script>
                  </body>
                  </html>
                `}}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={isMapFullscreen}
              />
              
              <TouchableOpacity style={styles.fullscreenBtn} onPress={toggleFullscreen}>
                <Ionicons name={isMapFullscreen ? "contract" : "expand"} size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.externalMapBtn} onPress={openExternalMaps}>
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.externalMapBtnText}>Abrir en Maps / Waze</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location-outline" size={50} color="#475569" />
              <Text style={styles.mapPlaceholderText}>Sin coordenadas registradas</Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.clientName}>{cliente.nombres} {cliente.apellidos}</Text>
          <Text style={styles.clientSub}>{cliente.nombre_comercial || 'Sin nombre comercial'}</Text>
          <View style={styles.divider} />
          <InfoRow icon="location" label="Dirección" value={cliente.direccion} />
          <InfoRow icon="call" label="Teléfono" value={cliente.telefono || 'No registrado'} />
          <View style={styles.statusBox}>
             <Text style={styles.statusLabel}>ESTADO ACTUAL</Text>
             <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
             </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
          {ESTADOS_GESTIONADOS.includes(cliente.estado) ? (
            <View style={[styles.mainBtn, { backgroundColor: '#f1f5f9', width: '100%', elevation: 0 }]}>
               <Ionicons name="checkmark-done-circle" size={20} color="#94a3b8" />
               <Text style={[styles.mainBtnText, { color: '#94a3b8' }]}>CLIENTE YA GESTIONADO</Text>
            </View>
          ) : isOwner ? (
            <View style={{ flexDirection: 'row', flex: 1, gap: 12 }}>
               <TouchableOpacity 
                 style={styles.releaseBtn} 
                 onPress={handleReleaseVisit} 
                 disabled={loading}
               >
                 <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                 <Text style={styles.releaseBtnText}>CANCELAR</Text>
               </TouchableOpacity>
               
               <TouchableOpacity 
                 style={[styles.mainBtn, { backgroundColor: '#10b981', flex: 1.5 }]} 
                 onPress={handleGoToFicha} 
                 disabled={loading}
               >
                 <Ionicons name="document-text-outline" size={20} color="#fff" />
                 <Text style={styles.mainBtnText}>LLENAR FICHA</Text>
               </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.mainBtn, { backgroundColor: isLockedByOther ? '#cbd5e1' : '#3b82f6', width: '100%' }]} 
              onPress={handleStartVisit}
              disabled={loading || isLockedByOther}
            >
              <Ionicons name={isLockedByOther ? "lock-closed" : "play"} size={20} color="#fff" />
              <Text style={styles.mainBtnText}>
                {isLockedByOther ? 'CLIENTE OCUPADO' : 'VISITAR'}
              </Text>
            </TouchableOpacity>
          )}
      </View>
    </SafeAreaView>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.iconBox}><Ionicons name={icon} size={20} color="#3b82f6" /></View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingBottom: 100 },
  mapContainer: { width: width, height: 280, backgroundColor: '#1e293b', overflow: 'hidden' },
  mapFullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: '100%', zIndex: 100, marginTop: 0 },
  map: { flex: 1 },
  fullscreenBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)', padding: 10,
    borderRadius: 12, zIndex: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  mapLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  mapLoadingText: { color: '#64748b', marginTop: 10, fontSize: 13 },
  mapPlaceholder: { width: width, height: 280, alignItems: 'center', justifyContent: 'center', padding: 20 },
  mapPlaceholderText: { color: '#475569', fontSize: 15, fontWeight: '600', marginTop: 10 },
  externalMapBtn: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    elevation: 5,
  },
  externalMapBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', marginLeft: 8 },
  infoSection: { backgroundColor: '#fff', marginTop: -25, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, elevation: 15 },
  clientName: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  clientSub: { fontSize: 14, color: '#64748b', marginTop: 5 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 },
  infoRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' },
  infoValue: { fontSize: 15, color: '#1e293b', marginTop: 2, fontWeight: '500' },
  statusBox: { marginTop: 10, padding: 15, backgroundColor: '#f8fafc', borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  statusLabel: { fontSize: 9, color: '#94a3b8', fontWeight: 'bold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 10 },
  mainBtn: { height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  mainBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  releaseBtn: { flex: 1, height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ef4444', backgroundColor: '#fff' },
  releaseBtnText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginLeft: 5 },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  offlineText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginTop: 10 },
  offlineSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }
});

// Envuelve la pantalla con ErrorBoundary para capturar cualquier crash
const DetalleClienteScreenSafe = ({ route, navigation }) => (
  <ErrorBoundary context="DetalleClienteScreen" onBack={() => navigation.goBack()}>
    <DetalleClienteScreen route={route} navigation={navigation} />
  </ErrorBoundary>
);

export default DetalleClienteScreenSafe;
