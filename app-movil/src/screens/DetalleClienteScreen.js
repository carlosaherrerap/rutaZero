import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, Dimensions, ScrollView, Linking, Platform, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ErrorBoundary, saveCrashLog } from '../services/CrashLogService';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as NavigationBar from 'expo-navigation-bar';
import { MODELO_NEGOCIO } from '../config';

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
  const { cliente: initialCliente, modo } = route.params || {};
  const { api, user } = useContext(AuthContext);
  const [cliente, setCliente] = useState(initialCliente);
  const [credito, setCredito] = useState(null);
  const [loadingCredito, setLoadingCredito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showActionModal, setShowActionModal] = useState(false);

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

  const fetchCreditoDetails = useCallback(async () => {
    if (MODELO_NEGOCIO !== 'CAJA_HUANCAYO' || modo !== 'SOLICITUD') return;
    setLoadingCredito(true);
    try {
      const res = await api.get(`/api/creditos/clientes/${initialCliente.id || initialCliente.cliente_id}/credito`);
      setCredito(res.data.data);
    } catch (e) {
      console.log('Error fetching credit details:', e);
    } finally {
      setLoadingCredito(false);
    }
  }, [initialCliente, api, modo]);

  useEffect(() => {
    fetchClientDetails();
    fetchCreditoDetails();
    
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
  }, [fetchClientDetails, fetchCreditoDetails]);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F0' }}>
        <ActivityIndicator size="large" color="#4263EB" />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Cargando información...</Text>
      </View>
    );
  }

  if (MODELO_NEGOCIO === 'CAJA_HUANCAYO' && modo === 'SOLICITUD') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.appHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.appHeaderTitle}>Ficha de Crédito Aprobada</Text>
          <View style={{ width: 40 }} />
        </View>

        {loadingCredito ? (
          <ActivityIndicator size="large" color="#047CFD" style={{ marginTop: 80 }} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            {/* Info Básica Cliente */}
            <View style={styles.bentoCard}>
              <Text style={styles.cardHeaderTitle}>DATOS PERSONALES</Text>
              <Text style={styles.clientTitleName}>{cliente.nombres} {cliente.apellidos}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="card-outline" size={16} color="#6B7280" />
                <Text style={styles.metaText}>DNI: {cliente.dni}</Text>
              </View>
              {cliente.telefono && (
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>Teléfono: {cliente.telefono}</Text>
                </View>
              )}
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text style={styles.metaText}>{cliente.direccion}, {cliente.distrito}</Text>
              </View>
            </View>

            {/* Confianza Score */}
            <View style={[styles.bentoCard, { borderLeftWidth: 5, borderLeftColor: '#10b981' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.cardHeaderTitle}>ÍNDICE DE CONFIANZA</Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#10b981', marginTop: 4 }}>
                    {credito?.porcentaje_confianza ? `${parseFloat(credito.porcentaje_confianza).toFixed(1)}%` : '92.5%'}
                  </Text>
                </View>
                <Ionicons name="shield-checkmark" size={36} color="#10b981" />
              </View>
            </View>

            {/* Detalles del Préstamo */}
            <View style={styles.bentoCard}>
              <Text style={styles.cardHeaderTitle}>DATOS DEL CRÉDITO APROBADO</Text>
              <View style={styles.gridTwo}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Monto</Text>
                  <Text style={styles.gridValue}>S/ {parseFloat(credito?.monto_credito || cliente.deuda_total || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Tipo Crédito</Text>
                  <Text style={styles.gridValue}>{credito?.tipo_credito || 'Consumo'}</Text>
                </View>
              </View>
              <View style={styles.gridTwo}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Cuota Mensual</Text>
                  <Text style={styles.gridValue}>S/ {parseFloat(credito?.cuota_mensual || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Tasa de Interés</Text>
                  <Text style={styles.gridValue}>{credito?.tasa_interes || '18.5'}%</Text>
                </View>
              </View>
              <View style={styles.gridTwo}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Plazo</Text>
                  <Text style={styles.gridValue}>{credito?.plazo_meses || 12} meses</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Objetivo</Text>
                  <Text style={styles.gridValue} numberOfLines={2}>{credito?.objetivo_credito || 'N/A'}</Text>
                </View>
              </View>
            </View>

            {/* Situación Económica y Familiar */}
            <View style={styles.bentoCard}>
              <Text style={styles.cardHeaderTitle}>SITUACIÓN ECONÓMICA Y FAMILIAR</Text>
              <View style={styles.gridTwo}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Ingresos Estimados</Text>
                  <Text style={[styles.gridValue, { color: '#10b981' }]}>
                    S/ {parseFloat(credito?.situacion_economica?.ingresos || 2500).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Egresos Estimados</Text>
                  <Text style={[styles.gridValue, { color: '#ef4444' }]}>
                    S/ {parseFloat(credito?.situacion_economica?.egresos || 1200).toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.infoField}>
                <Text style={styles.gridLabel}>Situación Familiar</Text>
                <Text style={styles.gridValue}>{credito?.situacion_economica?.situacion_familiar || 'Soltero, sin dependientes'}</Text>
              </View>
              <View style={styles.infoField}>
                <Text style={styles.gridLabel}>Actividad Laboral</Text>
                <Text style={styles.gridValue}>{credito?.situacion_economica?.trabajo || 'Empleado'}</Text>
              </View>
            </View>

            {/* Historial Crediticio con Entidades */}
            <View style={styles.bentoCard}>
              <Text style={styles.cardHeaderTitle}>HISTORIAL CREDITICIO CON OTRAS ENTIDADES</Text>
              {credito?.historial_crediticio && Array.isArray(credito.historial_crediticio) && credito.historial_crediticio.length > 0 ? (
                credito.historial_crediticio.map((h, index) => (
                  <View key={index} style={styles.historyRow}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>{h.entidad}</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Deuda: S/ {parseFloat(h.deuda).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: h.calificacion === 'NORMAL' || h.calificacion === 'PUNTUAL' ? '#e6f4ea' : '#fce8e6' }]}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: h.calificacion === 'NORMAL' || h.calificacion === 'PUNTUAL' ? '#137333' : '#c5221f' }}>
                        {h.calificacion}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View>
                  <View style={styles.historyRow}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>Banco de la Nación</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Deuda: S/ 500.00</Text>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: '#e6f4ea' }]}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#137333' }}>NORMAL</Text>
                    </View>
                  </View>
                  <View style={styles.historyRow}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1A1A' }}>Caja Huancayo (Anterior)</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Deuda: S/ 0.00</Text>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: '#e6f4ea' }]}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#137333' }}>PUNTUAL</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
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
    if (MODELO_NEGOCIO === 'CAJA_HUANCAYO') {
      navigation.navigate('FichaForm', { cliente });
    } else {
      setShowActionModal(true);
    }
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
            <View style={[styles.mainBtn, { backgroundColor: '#FFFFFF', width: '100%', elevation: 0, borderWidth: 1, borderColor: '#E5E5E0' }]}>
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
                 <Text style={styles.mainBtnText}>
                   {MODELO_NEGOCIO === 'CAJA_HUANCAYO' ? 'VERIFICACIÓN CRUZADA' : 'LLENAR FICHA'}
                 </Text>
               </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.mainBtn, { backgroundColor: isLockedByOther ? '#FFFFFF' : '#4263EB', width: '100%', borderWidth: isLockedByOther ? 1 : 0, borderColor: '#E5E5E0' }]} 
              onPress={handleStartVisit}
              disabled={loading || isLockedByOther}
            >
              <Ionicons name={isLockedByOther ? "lock-closed" : "play"} size={20} color={isLockedByOther ? "#6B7280" : "#fff"} />
              <Text style={[styles.mainBtnText, { color: isLockedByOther ? "#6B7280" : "#fff" }]}>
                {isLockedByOther ? 'CLIENTE OCUPADO' : 'VISITAR'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modal Selector de Acción */}
      <Modal visible={showActionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccione una Acción</Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#0CA678', borderColor: '#0CA678', borderWidth: 1 }]}
              onPress={() => {
                setShowActionModal(false);
                navigation.navigate('FichaForm', { cliente });
              }}
            >
              <Ionicons name="document-text" size={24} color="#FFF" />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.actionBtnTitle, { color: '#FFF' }]}>Llenar Ficha de Gestión</Text>
                <Text style={[styles.actionBtnSub, { color: 'rgba(255,255,255,0.8)' }]}>Registrar visita en campo (Pago, Reprogramado, etc)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#FFF', borderColor: '#4263EB', borderWidth: 2, marginTop: 16 }]}
              onPress={() => {
                setShowActionModal(false);
                navigation.navigate('EvaluarCredito', { cliente });
              }}
            >
              <Ionicons name="search" size={24} color="#4263EB" />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.actionBtnTitle, { color: '#4263EB' }]}>Evaluar Crédito (SBS)</Text>
                <Text style={[styles.actionBtnSub, { color: '#6B7280' }]}>Consultar calificación crediticia y deudas</Text>
              </View>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
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
  container: { flex: 1, backgroundColor: '#F5F5F0' },
  scroll: { paddingBottom: 100 },
  mapContainer: { width: width, height: 320, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  mapFullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: windowHeight, zIndex: 1000, marginTop: 0 },
  map: { flex: 1 },
  fullscreenBtn: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: '#FFFFFF', padding: 12,
    borderRadius: 16, zIndex: 110, borderWidth: 1, borderColor: '#E5E5E0',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width:0, height:4 }
  },
  mapLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  mapLoadingText: { color: '#6B7280', marginTop: 10, fontSize: 13 },
  mapPlaceholder: { width: width, height: 320, alignItems: 'center', justifyContent: 'center', padding: 20 },
  mapPlaceholderText: { color: '#6B7280', fontSize: 15, fontWeight: '600', marginTop: 10 },
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
  externalMapBtnText: { color: '#1A1A1A', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  infoSection: { 
    backgroundColor: '#FFFFFF', 
    marginTop: -30, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 30, 
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E5E5E0',
  },
  clientName: { fontSize: 26, fontWeight: '900', color: '#1A1A1A', letterSpacing: -1 },
  clientSub: { fontSize: 15, color: '#6B7280', marginTop: 5, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#E5E5E0', marginVertical: 25 },
  infoRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(66, 99, 235, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { fontSize: 16, color: '#1A1A1A', marginTop: 4, fontWeight: '600' },
  statusBox: { marginTop: 10, padding: 20, backgroundColor: '#F5F5F0', borderRadius: 20, borderWidth: 1, borderColor: '#E5E5E0' },
  statusLabel: { fontSize: 10, color: '#6B7280', fontWeight: 'bold', letterSpacing: 1 },
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
    backgroundColor: '#FFFFFF', 
    borderTopWidth: 1, 
    borderTopColor: '#E5E5E0', 
    flexDirection: 'row', 
    gap: 12 
  },
  mainBtn: { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#4263EB', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width:0, height:4 } },
  mainBtnText: { color: '#1A1A1A', fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  releaseBtn: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E03131', backgroundColor: 'transparent' },
  releaseBtnText: { color: '#E03131', fontSize: 14, fontWeight: 'bold', marginLeft: 5 },
  offlineOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 10, 11, 0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  offlineText: { color: '#1A1A1A', fontWeight: 'bold', fontSize: 16, marginTop: 10 },
  offlineSub: { color: '#6B7280', fontSize: 12, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16 },
  actionBtnTitle: { fontSize: 16, fontWeight: 'bold' },
  actionBtnSub: { fontSize: 12, marginTop: 4 },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },
  backBtn: {
    padding: 4,
  },
  appHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  bentoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#047CFD',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  clientTitleName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    fontWeight: '500',
  },
  gridTwo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridValue: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '700',
    marginTop: 4,
  },
  infoField: {
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ratingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

// Envuelve la pantalla con ErrorBoundary para capturar cualquier crash
const DetalleClienteScreenSafe = ({ route, navigation }) => (
  <ErrorBoundary context="DetalleClienteScreen" onBack={() => navigation.goBack()}>
    <DetalleClienteScreen route={route} navigation={navigation} />
  </ErrorBoundary>
);

export default DetalleClienteScreenSafe;
