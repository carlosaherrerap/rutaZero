import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, Dimensions, ScrollView, Linking, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary, saveCrashLog } from '../services/CrashLogService';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as NavigationBar from 'expo-navigation-bar';

const { width, height: windowHeight } = Dimensions.get('window');

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
    // La barra de navegación ahora se maneja globalmente por safe-area-context
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#00A9BC" />
        <Text style={{ marginTop: 10, color: '#64748B' }}>Cargando información...</Text>
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
      default: return { color: '#00A9BC', label: 'LIBRE' };
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
        nestedScrollEnabled={true}
      >
        <View style={[styles.mapContainer, isMapFullscreen && styles.mapFullscreen]}>
          {cliente.latitud ? (
            <>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: parseFloat(cliente.latitud),
                  longitude: parseFloat(cliente.longitud),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                showsUserLocation={true}
                showsMyLocationButton={false}
              >
                <Marker
                  coordinate={{
                    latitude: parseFloat(cliente.latitud),
                    longitude: parseFloat(cliente.longitud)
                  }}
                  title={cliente.nombres || ''}
                  pinColor="#00A9BC"
                />
                {routeCoords && routeCoords.length > 0 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#00A9BC"
                    strokeWidth={5}
                  />
                )}
              </MapView>
              
              <TouchableOpacity style={styles.fullscreenBtn} onPress={toggleFullscreen}>
                <Ionicons name={isMapFullscreen ? "contract" : "expand"} size={22} color="#1E293B" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.externalMapBtn} onPress={openExternalMaps}>
                <Ionicons name="navigate" size={18} color="#00A9BC" />
                <Text style={styles.externalMapBtnText}>Abrir en Maps / Waze</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location-outline" size={50} color="#94a3b8" />
              <Text style={styles.mapPlaceholderText}>Sin coordenadas registradas</Text>
            </View>
          )}
        </View>

        {!isMapFullscreen && (
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
        )}
      </ScrollView>

      {!isMapFullscreen && (
        <View style={styles.footer}>
          {ESTADOS_GESTIONADOS.includes(cliente.estado) ? (
            <View style={[styles.mainBtn, { backgroundColor: 'rgba(255, 255, 255, 0.03)', width: '100%', elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]}>
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
              style={[styles.mainBtn, { backgroundColor: isLockedByOther ? 'rgba(255,255,255,0.03)' : '#00A9BC', width: '100%' }]} 
              onPress={handleStartVisit}
              disabled={loading || isLockedByOther}
            >
              <Ionicons name={isLockedByOther ? "lock-closed" : "play"} size={20} color={isLockedByOther ? "#64748b" : "#fff"} />
              <Text style={[styles.mainBtnText, { color: isLockedByOther ? "#64748b" : "#fff" }]}>
                {isLockedByOther ? 'CLIENTE OCUPADO' : 'VISITAR'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.iconBox}><Ionicons name={icon} size={20} color="#00A9BC" /></View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { paddingBottom: 100 },
  mapContainer: { width: width, height: 280, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  mapFullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: windowHeight, zIndex: 1000, marginTop: 0 },
  map: { flex: 1 },
  fullscreenBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#FFFFFF', padding: 10,
    borderRadius: 12, zIndex: 110, borderWidth: 1, borderColor: '#E2E8F0'
  },
  mapLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  mapLoadingText: { color: '#64748B', marginTop: 10, fontSize: 13 },
  mapPlaceholder: { width: width, height: 280, alignItems: 'center', justifyContent: 'center', padding: 20 },
  mapPlaceholderText: { color: '#64748B', fontSize: 15, fontWeight: '600', marginTop: 10 },
  externalMapBtn: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  externalMapBtnText: { color: '#00A9BC', fontSize: 12, fontWeight: '800', marginLeft: 8 },
  infoSection: { 
    backgroundColor: '#FFFFFF', 
    marginTop: -25, 
    borderTopLeftRadius: 35, 
    borderTopRightRadius: 35, 
    padding: 30, 
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clientName: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  clientSub: { fontSize: 14, color: '#64748B', marginTop: 5 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 20 },
  infoRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(0, 169, 188, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 10, color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#1E293B', marginTop: 2, fontWeight: '500' },
  statusBox: { marginTop: 10, padding: 15, backgroundColor: '#F8FAFC', borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  statusLabel: { fontSize: 9, color: '#64748B', fontWeight: 'bold', letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 20, 
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: '#E2E8F0', 
    flexDirection: 'row', 
    gap: 10 
  },
  mainBtn: { height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  releaseBtn: { flex: 1, height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ef4444', backgroundColor: 'transparent' },
  releaseBtnText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginLeft: 5 },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  offlineText: { color: '#1E293B', fontWeight: 'bold', fontSize: 16, marginTop: 10 },
  offlineSub: { color: '#64748B', fontSize: 12, marginTop: 4 }
});

// Envuelve la pantalla con ErrorBoundary para capturar cualquier crash
const DetalleClienteScreenSafe = ({ route, navigation }) => (
  <ErrorBoundary context="DetalleClienteScreen" onBack={() => navigation.goBack()}>
    <DetalleClienteScreen route={route} navigation={navigation} />
  </ErrorBoundary>
);

export default DetalleClienteScreenSafe;
