import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, Dimensions, ScrollView, Linking, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as NavigationBar from 'expo-navigation-bar';

const { width } = Dimensions.get('window');

const ESTADOS_GESTIONADOS = ['VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO'];

const DetalleClienteScreen = ({ route, navigation }) => {
  const { cliente: initialCliente } = route.params || {};
  const { api, user } = useContext(AuthContext);
  const [cliente, setCliente] = useState(initialCliente);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

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
  }, [fetchClientDetails]);

  // 2. Obtener ubicación actual y trazar ruta inicial
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Configuración inmersiva total para ocultar barra inferior
      NavigationBar.setVisibilityAsync('hidden');
    }
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
      case 'EN_VISITA': return { color: '#a855f7', label: 'EN CAMINO (MORADO)' };
      case 'VISITADO_PAGO': return { color: '#10b981', label: 'GESTIONADO (VERDE)' };
      case 'REPROGRAMADO': return { color: '#f59e0b', label: 'REPROGRAMADO (AMARILLO)' };
      case 'NO_ENCONTRADO': return { color: '#ef4444', label: 'NO ENCONTRADO (ROJO)' };
      default: return { color: '#3b82f6', label: 'LIBRE (AZUL)' };
    }
  };

  const statusInfo = getStatusInfo(cliente.estado);

  const handleStartVisit = async () => {
    setLoading(true);
    try {
      await api.post(`/api/workers/clientes/${cliente.id}/visitar`);
      // Actualizar localmente para ver cambios sin retroceder
      setCliente(prev => ({ ...prev, estado: 'EN_VISITA', bloqueado_por: user.id }));
      Alert.alert('Éxito', 'Visita iniciada. El cliente ahora está EN CAMINO.');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo iniciar la visita';
      Alert.alert('Aviso', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToFicha = () => {
    navigation.navigate('FichaForm', { cliente });
  };

  const handleReleaseVisit = async () => {
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
              await api.patch(`/api/workers/clientes/${cliente.id}/liberar`);
              setCliente(prev => ({ ...prev, estado: 'LIBRE', bloqueado_por: null }));
              Alert.alert('Liberado', 'Cliente disponible nuevamente.');
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mapContainer}>
           <MapView
             style={styles.map}
             initialRegion={{
               latitude: parseFloat(cliente.latitud) || -12.046374,
               longitude: parseFloat(cliente.longitud) || -77.042793,
               latitudeDelta: 0.015,
               longitudeDelta: 0.015,
             }}
           >
             <Marker
               coordinate={{
                 latitude: parseFloat(cliente.latitud) || -12.046374,
                 longitude: parseFloat(cliente.longitud) || -77.042793,
               }}
             >
                <Ionicons name="location" size={35} color={statusInfo.color} />
             </Marker>

             {userLocation && (
               <Marker coordinate={userLocation} title="Tu ubicación">
                  <View style={styles.workerMarker}>
                     <Ionicons name="bicycle" size={20} color="#fff" />
                  </View>
               </Marker>
             )}

             {routeCoords.length > 0 && (
               <Polyline
                 coordinates={routeCoords}
                 strokeWidth={5}
                 strokeColor="#a855f7"
               />
             )}
           </MapView>

           <View style={styles.mapActions}>
              <TouchableOpacity style={styles.mapBtn} onPress={openExternalMaps}>
                 <Ionicons name="navigate-circle" size={24} color="#3b82f6" />
                 <Text style={styles.mapBtnText}>Waze / Google</Text>
              </TouchableOpacity>
           </View>
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
  mapContainer: { width: width, height: 300, backgroundColor: '#e2e8f0' },
  map: { width: '100%', height: '100%' },
  mapActions: { position: 'absolute', bottom: 15, right: 15 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 12, elevation: 5 },
  mapBtnText: { marginLeft: 5, fontWeight: '700', fontSize: 12, color: '#3b82f6' },
  workerMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  infoSection: { backgroundColor: '#fff', marginTop: -20, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, elevation: 10 },
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
  releaseBtnText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold', marginLeft: 5 }
});

export default DetalleClienteScreen;
