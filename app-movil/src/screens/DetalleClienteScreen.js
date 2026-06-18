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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0B' }}>
        <ActivityIndicator size="large" color="#4263EB" />
        <Text style={{ marginTop: 10, color: '#A1A1AA' }}>Cargando información...</Text>
      </View>
    );
  }

  // Lógica de estados con comparación robusta de IDs (string vs number)
  const isOwner = String(cliente.bloqueado_por) === String(user.id);
  const isEnVisita = cliente.estado === 'EN_VISITA';
  const isLockedByOther = isEnVisita && !isOwner;

  const getStatusInfo = (estado) => {
    switch (estado) {
      case 'EN_VISITA': return { color: '#845EF7', label: 'EN CAMINO' };
      case 'VISITADO_PAGO': return { color: '#0CA678', label: 'GESTIONADO' };
      case 'REPROGRAMADO': return { color: '#FFC038', label: 'REPROGRAMADO' };
      default: return { color: '#4263EB', label: 'LIBRE' };
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
      Alert.alert('Éxito', 'Visita iniciada. Ahora estás en camino al cliente');
    } catch (err) {
      console.log('❌ [Visit] Error al iniciar visita:', err.message);
      const msg = err.response?.data?.error || 'No se pudo iniciar la visita';
      if (err.response?.status === 409) {
        Alert.alert('No Permitido', msg);
      } else {
        Alert.alert('Aviso', msg);
      }
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
                  pinColor="#002FA7"
                />
                {routeCoords && routeCoords.length > 0 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#002FA7"
                    strokeWidth={5}
                  />
                )}
              </MapView>
              
              <TouchableOpacity style={styles.fullscreenBtn} onPress={toggleFullscreen}>
                <Ionicons name={isMapFullscreen ? "contract" : "expand"} size={22} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.externalMapBtn} onPress={openExternalMaps}>
                <Ionicons name="navigate" size={18} color="#FFF" />
                <Text style={styles.externalMapBtnText}>Abrir en Maps / Waze</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location-outline" size={50} color="#3F3F46" />
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
            <View style={[styles.mainBtn, { backgroundColor: '#141416', width: '100%', elevation: 0, borderWidth: 1, borderColor: '#28282E' }]}>
               <Ionicons name="checkmark-done-circle" size={20} color="#0CA678" />
               <Text style={[styles.mainBtnText, { color: '#0CA678' }]}>CLIENTE YA GESTIONADO</Text>
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
                 style={[styles.mainBtn, { backgroundColor: '#0CA678', flex: 1.5 }]} 
                 onPress={handleGoToFicha} 
                 disabled={loading}
               >
                 <Ionicons name="document-text-outline" size={20} color="#fff" />
                 <Text style={styles.mainBtnText}>LLENAR FICHA</Text>
               </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.mainBtn, { backgroundColor: isLockedByOther ? '#141416' : '#4263EB', width: '100%', borderWidth: isLockedByOther ? 1 : 0, borderColor: '#28282E' }]} 
              onPress={handleStartVisit}
              disabled={loading || isLockedByOther}
            >
              <Ionicons name={isLockedByOther ? "lock-closed" : "play"} size={20} color={isLockedByOther ? "#A1A1AA" : "#fff"} />
              <Text style={[styles.mainBtnText, { color: isLockedByOther ? "#A1A1AA" : "#fff" }]}>
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
    <View style={styles.iconBox}><Ionicons name={icon} size={20} color="#4263EB" /></View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0B' },
  scroll: { paddingBottom: 100 },
  mapContainer: { width: width, height: 320, backgroundColor: '#141416', overflow: 'hidden' },
  mapFullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: windowHeight, zIndex: 1000, marginTop: 0 },
  map: { flex: 1 },
  fullscreenBtn: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: '#141416', padding: 12,
    borderRadius: 16, zIndex: 110, borderWidth: 1, borderColor: '#28282E',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width:0, height:4 }
  },
  mapLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#141416', justifyContent: 'center', alignItems: 'center' },
  mapLoadingText: { color: '#A1A1AA', marginTop: 10, fontSize: 13 },
  mapPlaceholder: { width: width, height: 320, alignItems: 'center', justifyContent: 'center', padding: 20 },
  mapPlaceholderText: { color: '#A1A1AA', fontSize: 15, fontWeight: '600', marginTop: 10 },
  externalMapBtn: {
    position: 'absolute',
    bottom: 45,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4263EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#4263EB', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width:0, height:4 }
  },
  externalMapBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  infoSection: { 
    backgroundColor: '#141416', 
    marginTop: -30, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 30, 
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#28282E',
  },
  clientName: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  clientSub: { fontSize: 15, color: '#A1A1AA', marginTop: 5, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#28282E', marginVertical: 25 },
  infoRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(66, 99, 235, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#71717A', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { fontSize: 16, color: '#FFFFFF', marginTop: 4, fontWeight: '600' },
  statusBox: { marginTop: 10, padding: 20, backgroundColor: '#0A0A0B', borderRadius: 20, borderWidth: 1, borderColor: '#28282E' },
  statusLabel: { fontSize: 10, color: '#71717A', fontWeight: 'bold', letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText: { fontSize: 15, fontWeight: '800' },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#141416', 
    borderTopWidth: 1, 
    borderTopColor: '#28282E', 
    flexDirection: 'row', 
    gap: 12 
  },
  mainBtn: { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#4263EB', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width:0, height:4 } },
  mainBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  releaseBtn: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E03131', backgroundColor: 'transparent' },
  releaseBtnText: { color: '#E03131', fontSize: 14, fontWeight: 'bold', marginLeft: 5 },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 10, 11, 0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  offlineText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, marginTop: 10 },
  offlineSub: { color: '#A1A1AA', fontSize: 12, marginTop: 4 }
});

// Envuelve la pantalla con ErrorBoundary para capturar cualquier crash
const DetalleClienteScreenSafe = ({ route, navigation }) => (
  <ErrorBoundary context="DetalleClienteScreen" onBack={() => navigation.goBack()}>
    <DetalleClienteScreen route={route} navigation={navigation} />
  </ErrorBoundary>
);

export default DetalleClienteScreenSafe;
