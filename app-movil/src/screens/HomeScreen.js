import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  Alert, ActivityIndicator, Dimensions, Modal, ScrollView, Platform, TextInput
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { TrackingService } from '../services/TrackingService';
import { MODELO_NEGOCIO } from '../config';

const { width } = Dimensions.get('window');

const STATUS_OPTIONS = [
  { id: 'TODOS', label: 'TODOS', color: '#64748b' },
  { id: 'EN_VISITA', label: 'EN CAMINO', color: '#a855f7' },
  { id: 'VISITADO_PAGO', label: 'GESTIONADO', color: '#10b981' },
  { id: 'REPROGRAMADO', label: 'REPROG.', color: '#f59e0b' },
  { id: 'NO_ENCONTRADO', label: 'NO ENCONTR.', color: '#ef4444' },
];

// Cronómetro: cuenta hh:mm:ss desde un timestamp de inicio
function useCronometro(startTime) {
  const [elapsed, setElapsed] = useState('00:00:00');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!startTime) {
      setElapsed('00:00:00');
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const tick = () => {
      try {
        const now = new Date();
        const start = new Date(startTime);
        
        if (isNaN(start.getTime())) {
          console.warn('⚠️ [useCronometro] startTime inválido:', startTime);
          setElapsed('00:00:00');
          return;
        }

        let diff = Math.floor((now.getTime() - start.getTime()) / 1000);
        if (diff < 0) diff = 0;

        const h = String(Math.floor(diff / 3600)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');
        setElapsed(`${h}:${m}:${s}`);
      } catch (err) {
        console.error('❌ [useCronometro] Error:', err);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [startTime]);

  return elapsed;
}

// Formatea el nombre del worker en formato: Nombre + Inicial Primer Apellido + Inicial Segundo Apellido
function formatWorkerName(nombres, apellidos, fullName) {
  if (nombres) {
    const namePart = nombres.trim().split(/\s+/)[0];
    if (!apellidos) return namePart;
    const apellidoParts = apellidos.trim().split(/\s+/).filter(Boolean);
    if (apellidoParts.length === 0) return namePart;
    const firstInitial = apellidoParts[0].charAt(0).toUpperCase();
    if (apellidoParts.length > 1) {
      const secondInitial = apellidoParts[1].charAt(0).toUpperCase();
      return `${namePart} ${firstInitial}.${secondInitial}`;
    }
    return `${namePart} ${firstInitial}.`;
  } else if (fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const namePart = parts[0];
    if (parts.length === 1) return namePart;
    if (parts.length === 3) {
      return `${namePart} ${parts[1].charAt(0).toUpperCase()}.${parts[2].charAt(0).toUpperCase()}`;
    }
    if (parts.length === 2) {
      return `${namePart} ${parts[1].charAt(0).toUpperCase()}.`;
    }
    if (parts.length >= 4) {
      const firstSurnameInitial = parts[parts.length - 2].charAt(0).toUpperCase();
      const secondSurnameInitial = parts[parts.length - 1].charAt(0).toUpperCase();
      return `${namePart} ${firstSurnameInitial}.${secondSurnameInitial}`;
    }
  }
  return null;
}

export default function HomeScreen({ navigation }) {
  const { api, user, logout } = useContext(AuthContext);
  const [journey, setJourney] = useState(null); // jornada del día
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('TODOS');
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Estado local de clientes para reflejar cambios offline en tiempo real
  const [localClients, setLocalClients] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  const handleToggleClientSelection = async (clientId) => {
    let newSelection;
    if (selectedClientIds.includes(clientId)) {
      newSelection = selectedClientIds.filter(id => id !== clientId);
    } else {
      newSelection = [...selectedClientIds, clientId];
    }
    
    setSelectedClientIds(newSelection);

    // Si está online, guardar en backend
    if (isOnline && api) {
      try {
        await api.post('/api/rutas/auto-crear', { cliente_ids: newSelection });
        console.log('✅ Ruta auto-creada en el servidor');
      } catch (err) {
        console.warn('⚠️ Error al guardar selección de ruta online:', err.message);
      }
    }

    // Guardar en cache local (actualizando las rutas del día)
    try {
      const { getDayData, saveDayData } = require('../services/OfflineService');
      const cached = await getDayData();
      if (cached) {
        // Mapear la selección a objetos ruta_clientes
        const newRutasData = newSelection.map((id, index) => {
          const clientObj = cached.clients?.find(c => String(c.id) === id) || {};
          return {
            cliente_id: id,
            cliente_estado: clientObj.estado || 'LIBRE',
            nombres: clientObj.nombres || '',
            apellidos: clientObj.apellidos || '',
            orden: index + 1,
            deuda_total: clientObj.deuda_total || 0,
            cliente_direccion: clientObj.direccion || '',
            distrito: clientObj.distrito || '',
            latitud: clientObj.latitud || 0,
            longitud: clientObj.longitud || 0
          };
        });
        cached.rutas = newRutasData;
        await saveDayData(cached);
      }
    } catch (err) {
      console.warn('⚠️ Error al actualizar cache de ruta local:', err.message);
    }
  };

  // Cronómetro de almuerzo (corre solo si estado es EN_REFRIGERIO)
  const almuerzoStart = journey?.estado_jornada === 'EN_REFRIGERIO' ? journey?.hora_inicio_almuerzo : null;
  const timerAlmuerzo = useCronometro(almuerzoStart);

  // Detector de conexión
  useEffect(() => {
    console.log('🔌 [Home] Iniciando detector de conexión...');
    const { addEventListener } = require('@react-native-community/netinfo');
    const { initOfflineDB, syncAllOfflineData } = require('../services/OfflineService');
    
    initOfflineDB();
    const unsubscribe = addEventListener(state => {
      console.log(`📶 [NetInfo] Conectado: ${state.isConnected}, Tipo: ${state.type}`);
      setIsOnline(state.isConnected);
      if (state.isConnected && api) {
        console.log('🔄 [Home] Internet recuperado, intentando sync...');
        syncAllOfflineData(api);
      }
    });

    const interval = setInterval(() => {
      if (isOnline && api) {
        console.log('⏰ [Home] Sync periódico (10min)');
        syncAllOfflineData(api);
      }
    }, 1000 * 60 * 10);

    // TRACKING GPS (Cada 20 segundos si está en jornada)
    const trackingInterval = setInterval(async () => {
      if (isOnline && api && journey?.estado_jornada === 'JORNADA_INICIADA') {
        try {
          // Usamos getCurrentPositionAsync para mayor precisión, pero con baja exactitud para balancear batería
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc) {
            api.post('/api/tracking/posicion', {
              latitud: loc.coords.latitude,
              longitud: loc.coords.longitude,
              precision_m: loc.coords.accuracy
            }).catch(() => {});
          }
        } catch (e) {
          console.log('⚠️ [Tracking] Error obteniendo ubicación:', e.message);
        }
      }
    }, 20000);

    return () => { 
      console.log('🔌 [Home] Limpiando detector de conexión');
      unsubscribe(); 
      clearInterval(interval); 
      clearInterval(trackingInterval);
    };
  }, [api, isOnline, journey?.estado_jornada]);

  // Ocultar barra de navegación del celular
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setVisibilityAsync('hidden');
        NavigationBar.setBehaviorAsync('overlay-swipe');
      } catch (e) {
        console.warn('Error setting NavigationBar visibility:', e);
      }
    }
  }, []);

  const [pendingOfflineIds, setPendingOfflineIds] = useState([]);
  const [pendingStatuses, setPendingStatuses] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async (pageNum = 1, shouldRefresh = false) => {
    if (!user) return;
    const { 
      saveDayData, getDayData, logConnectionStatus, getPendingClientIds 
    } = require('../services/OfflineService');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    console.log(`📡 [Home] fetchData(page=${pageNum}) - Solo hoy: ${todayStr} - Online: ${isOnline}`);
    
    try {
      // Siempre obtener pendientes para marcar en la lista
      const pending = await getPendingClientIds();
      setPendingOfflineIds(pending);

      // Cargar los estados de las fichas pendientes
      const rawQueue = await AsyncStorage.getItem('rz_pending_fichas');
      const queue = rawQueue ? JSON.parse(rawQueue) : [];
      const pendingMap = {};
      queue.forEach(item => {
        pendingMap[String(item.clienteId)] = item.formData.tipificacion === 'PAGO' ? 'VISITADO_PAGO' : 
                                            item.formData.tipificacion === 'REPROGRAMARA' ? 'REPROGRAMADO' : 'NO_ENCONTRADO';
      });
      setPendingStatuses(pendingMap);

      if (!isOnline) {
        const localData = await getDayData();
        if (localData) {
          if (pageNum === 1) {
            setJourney(localData.journey);
            const clientIds = (localData.rutas || []).map(r => String(r.cliente_id)).filter(Boolean);
            setSelectedClientIds(clientIds);
          }
          // Filtrar por si acaso el cache tiene de otros días (aunque guardamos solo hoy)
          const todayClients = (localData.clients || []).filter(c => 
            c.fecha_pago?.split('T')[0] === todayStr || pending.includes(String(c.id))
          );
          setAllClients(todayClients);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // MODO ONLINE
      if (pageNum === 1 || shouldRefresh) {
        // Ejecutamos las peticiones en paralelo para mayor velocidad
        const [resWorker, resRutas, resClients] = await Promise.all([
          api.get(`/api/workers/${user.id}`),
          api.get('/api/workers/me/ruta'),
          api.get(`/api/clientes?page=${pageNum}&limit=100&fecha_pago=${todayStr}&vista=home`)
        ]);

        const freshJourney = resWorker.data.data;
        const rutasData = resRutas.data.data || [];
        const newData = resClients.data.data || [];
        
        setJourney(freshJourney);
        setHasMore(newData.length === 100);
        setAllClients(newData);
        setPage(pageNum);

        const clientIds = (rutasData || []).map(r => String(r.cliente_id)).filter(Boolean);
        setSelectedClientIds(clientIds);

        await saveDayData({
          journey: freshJourney, 
          clients: newData,
          rutas: rutasData
        });
        await logConnectionStatus('ONLINE');
      } else {
        const limit = 100;
        const resClients = await api.get(`/api/clientes?page=${pageNum}&limit=${limit}&fecha_pago=${todayStr}&vista=home`);
        const newData = resClients.data.data || [];
        setHasMore(newData.length === limit);
        setAllClients(prev => [...prev, ...newData]);
        setPage(pageNum);
      }
    } catch (e) {
      console.log('❌ [Home] Error en fetchData:', e.message);
      const localData = await getDayData();
      if (localData) {
        if (pageNum === 1) {
          setJourney(localData.journey);
          const clientIds = (localData.rutas || []).map(r => String(r.cliente_id)).filter(Boolean);
          setSelectedClientIds(clientIds);
        }
        setAllClients(localData.clients || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, api, isOnline]);

  useFocusEffect(useCallback(() => { 
    setLoading(true);
    fetchData(1, true); 
  }, [fetchData]));

  // Sincronizar localClients cuando cambia allClients
  useEffect(() => {
    setLocalClients(allClients);
  }, [allClients]);

  // Al volver a la pantalla, releer del caché local para reflejar cambios offline
  useFocusEffect(useCallback(() => {
    const syncLocalState = async () => {
      const { getDayData } = require('../services/OfflineService');
      if (!isOnline) {
        const cached = await getDayData();
        if (cached?.clients) setLocalClients(cached.clients);
      }
    };
    syncLocalState();
  }, [isOnline]));

  useEffect(() => {
    let result = localClients;
    if (filterStatus !== 'TODOS') {
      result = result.filter(c => c.estado === filterStatus);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        (c.nombres && c.nombres.toLowerCase().includes(q)) || 
        (c.apellidos && c.apellidos.toLowerCase().includes(q)) ||
        (c.direccion && c.direccion.toLowerCase().includes(q))
      );
    }
    setFilteredClients(result);
  }, [filterStatus, localClients, searchQuery]);

  const loadMore = () => {
    if (hasMore && !loading && !refreshing) {
      fetchData(page + 1);
    }
  };

  // ── LÓGICA DE JORNADA ───────────────────────────────────────
  const jornadaEstado = journey?.estado_jornada || null;
  const puedeTrabajar = jornadaEstado === 'JORNADA_INICIADA';
  const enRefrigerio  = jornadaEstado === 'EN_REFRIGERIO';
  const finalizado    = jornadaEstado === 'JORNADA_FINALIZADA';

  const confirmarAccion = (titulo, mensaje, onSi) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'SÍ', onPress: onSi, style: 'destructive' }
    ]);
  };

  const handleIniciarDia = () => {
    confirmarAccion('Iniciar Día', '¿Deseas iniciar tu jornada laboral?', async () => {
      setActionLoading(true);
      const { saveJourneyActionOffline, updateLocalJourneyStatus } = require('../services/OfflineService');
      try {
        if (!isOnline) {
          await saveJourneyActionOffline('/api/workers/jornada/iniciar');
          await fetchData();
          setShowJourneyModal(false);
          Alert.alert('Modo Offline', 'Jornada iniciada localmente. Se sincronizará al recuperar señal.');
          return;
        }
        await api.post('/api/workers/jornada/iniciar');
        
        // LOG MONITOREO (En segundo plano para no bloquear al usuario)
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then(loc => {
            if (loc) {
              api.post('/api/monitoreo/log', {
                accion: 'JORNADA_INICIADA',
                metadata: { lat: loc.coords.latitude, lng: loc.coords.longitude }
              }).catch(() => {});
            }
          })
          .catch(e => console.log('⚠️ [Home] No se pudo obtener ubicación para log inicial'));

        await updateLocalJourneyStatus('JORNADA_INICIADA'); 
        await TrackingService.setStatus('LIBRE');
        await TrackingService.startTracking();
        setShowJourneyModal(false);
        // Actualizamos la data en paralelo
        fetchData(); 
        Alert.alert('¡Listo!', 'Jornada iniciada. ¡Buen día!');
      } catch (e) {
        Alert.alert('Error', 'No se pudo iniciar la jornada.');
      } finally { setActionLoading(false); }
    });
  };

  const handleIniciarAlmuerzo = () => {
    confirmarAccion('Receso', '¿Deseas empezar tu receso?', async () => {
      setActionLoading(true);
      const { saveJourneyActionOffline, updateLocalJourneyStatus } = require('../services/OfflineService');
      try {
        if (!isOnline) {
          await saveJourneyActionOffline('/api/workers/jornada/almuerzo/inicio');
          await fetchData();
          return;
        }
        await api.post('/api/workers/jornada/almuerzo/inicio');

        // LOG MONITOREO
        api.post('/api/monitoreo/log', { accion: 'ALMUERZO_INICIADO' }).catch(() => {});

        await updateLocalJourneyStatus('EN_REFRIGERIO', { hora_inicio_almuerzo: new Date().toISOString() });
        await TrackingService.setStatus('LIBRE'); // O podrías crear un estado 'RECESO'
        await fetchData();
      } catch (e) {
        Alert.alert('Error', 'No se pudo iniciar el receso.');
      } finally { setActionLoading(false); }
    });
  };

  const handleFinAlmuerzo = () => {
    confirmarAccion('Fin de Receso', '¿Deseas finalizar tu receso?', async () => {
      setActionLoading(true);
      const { saveJourneyActionOffline, updateLocalJourneyStatus } = require('../services/OfflineService');
      try {
        if (!isOnline) {
          await saveJourneyActionOffline('/api/workers/jornada/almuerzo/fin');
          await fetchData();
          return;
        }
        await api.post('/api/workers/jornada/almuerzo/fin');

        // LOG MONITOREO
        api.post('/api/monitoreo/log', { accion: 'ALMUERZO_FINALIZADO' }).catch(() => {});

        await updateLocalJourneyStatus('JORNADA_INICIADA');
        await fetchData();
      } catch (e) {
        Alert.alert('Error', 'No se pudo finalizar el receso.');
      } finally { setActionLoading(false); }
    });
  };

  const handleFinalizarDia = () => {
    confirmarAccion('Finalizar Día', '¿Deseas finalizar tu día laboral?', async () => {
      setActionLoading(true);
      const { saveJourneyActionOffline, clearOfflineCache, updateLocalJourneyStatus } = require('../services/OfflineService');
      try {
        if (!isOnline) {
          await saveJourneyActionOffline('/api/workers/jornada/finalizar');
          await fetchData();
          setShowJourneyModal(false);
          Alert.alert('Modo Offline', 'Día finalizado localmente.');
          return;
        }
        await api.post('/api/workers/jornada/finalizar');

        // LOG MONITOREO
        api.post('/api/monitoreo/log', { accion: 'JORNADA_FINALIZADA' }).catch(() => {});

        await updateLocalJourneyStatus('JORNADA_FINALIZADA');
        await TrackingService.stopTracking();
        await TrackingService.setStatus('INACTIVO');
        await clearOfflineCache(); 
        await fetchData();
        setShowJourneyModal(false);
        Alert.alert('¡Hasta mañana!', 'Jornada finalizada correctamente.');
      } catch (e) {
        Alert.alert('Error', 'No se pudo finalizar la jornada.');
      } finally { setActionLoading(false); }
    });
  };
  
  const handleClearCache = () => {
    confirmarAccion('Limpiar Caché', '¿Estás seguro? Se borrarán todos los datos guardados localmente y gestiones pendientes de sincronizar.', async () => {
      const { clearOfflineCache } = require('../services/OfflineService');
      try {
        await clearOfflineCache();
        Alert.alert('Éxito', 'La caché ha sido limpiada correctamente.');
        fetchData(1, true);
      } catch (e) {
        Alert.alert('Error', 'No se pudo limpiar la caché.');
      }
    });
  };

  // ── RENDER CLIENTE ──────────────────────────────────────────
  const getStatusColor = (estado) => {
    switch (estado) {
      case 'EN_VISITA':     return '#A020F0';
      case 'VISITADO_PAGO': return '#00C853';
      case 'REPROGRAMADO':  return '#FFB300';
      case 'NO_ENCONTRADO': return '#D50000';
      default:              return '#047CFD'; // Azul Klein
    }
  };

  const renderClient = ({ item, index }) => {
    const isOfflinePending = pendingOfflineIds.includes(String(item.id));
    const estado = isOfflinePending ? (pendingStatuses[String(item.id)] || item.estado) : item.estado;
    const cardColor = getStatusColor(estado);
    
    // Bloquear: verificar si hay otro cliente ya en visita por este worker
    const clienteEnVisitaPorMi = localClients.find(
      c => c.estado === 'EN_VISITA' && String(c.bloqueado_por) === String(user.id)
    );
    const esteEstaEnVisitaPorMi = estado === 'EN_VISITA' && String(item.bloqueado_por) === String(user.id);
    
    // Bloqueado por OTRO worker (alguien más ya lo está visitando)
    const bloqueadoPorOtro = estado === 'EN_VISITA' && item.bloqueado_por && String(item.bloqueado_por) !== String(user.id);
    
    // Bloqueado porque YO ya tengo otro cliente en visita
    const bloqueadoPorMiOtro = clienteEnVisitaPorMi && !esteEstaEnVisitaPorMi;
    
    const bloqueado = bloqueadoPorOtro || bloqueadoPorMiOtro;

    return (
      <TouchableOpacity
        style={[styles.clientCard, { borderLeftColor: cardColor, opacity: bloqueado ? 0.55 : 1 }]}
        onPress={() => {
          if (MODELO_NEGOCIO === 'CAJA_HUANCAYO') {
            navigation.navigate('DetalleCliente', { cliente: item, modo: 'SOLICITUD' });
            return;
          }
          if (!puedeTrabajar) {
            Alert.alert('Atención', 'Debes iniciar tu jornada para gestionar clientes.');
            return;
          }
          const isGestionado = ['VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO'].includes(estado);
          if (isGestionado) {
            Alert.alert('Cliente ya gestionado', 'Este cliente ya cuenta con una visita registrada hoy.');
            return;
          }
          if (bloqueadoPorOtro) {
            Alert.alert(
              'Cliente ocupado',
              `Este cliente está siendo visitado por ${item.bloqueado_por_nombre || 'otro worker'}. No puedes gestionarlo en este momento.`
            );
            return;
          }
          if (bloqueadoPorMiOtro) {
            Alert.alert(
              'Cliente en curso',
              `Ya tienes a "${clienteEnVisitaPorMi.nombres} ${clienteEnVisitaPorMi.apellidos}" en visita. Libera ese cliente antes de seleccionar otro.`
            );
            return;
          }
          navigation.navigate('DetalleCliente', { cliente: item });
        }}
      >
        <View style={styles.clientInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
             <Text style={styles.clientName}>{item.nombres} {item.apellidos}</Text>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
               {MODELO_NEGOCIO === 'CAJA_HUANCAYO' && (
                 <TouchableOpacity
                   style={{ padding: 4 }}
                   onPress={() => handleToggleClientSelection(String(item.id))}
                 >
                   <Ionicons 
                     name={selectedClientIds.includes(String(item.id)) ? "checkbox" : "square-outline"} 
                     size={22} 
                     color="#047CFD" 
                   />
                 </TouchableOpacity>
               )}
               {isOfflinePending && (
                <View style={styles.offlineTag}>
                  <Ionicons name="cloud-offline" size={10} color="#fff" />
                  <Text style={styles.offlineTagText}>OFFLINE</Text>
                </View>
              )}
             </View>
          </View>
          <Text style={styles.clientSubtitle}>Deuda: S/ {parseFloat(item.deuda_total || 0).toFixed(2)}</Text>
          <Text style={styles.clientAddress} numberOfLines={2}>{item.direccion}{item.distrito ? `, ${item.distrito}` : ''}</Text>
          
          <View style={styles.cardFooter}>
            <Text style={styles.clientIndex}>{index + 1}</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {item.ruta_nombre ? (
                <View style={styles.rutaBadge}>
                  <Ionicons name="navigate-outline" size={11} color="#047CFD" />
                  <Text style={styles.rutaBadgeText} numberOfLines={1}>{item.ruta_nombre}</Text>
                </View>
              ) : (
                <View style={[styles.rutaBadge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Ionicons name="globe-outline" size={11} color="#16a34a" />
                  <Text style={[styles.rutaBadgeText, { color: '#16a34a' }]}>Libre</Text>
                </View>
              )}
              {/* Worker Badge */}
              {(() => {
                const formattedWorker = formatWorkerName(item.worker_nombres, item.worker_apellidos, item.worker_nombre);
                if (formattedWorker) {
                  return (
                    <View style={styles.workerBadge}>
                      <Ionicons name="person-circle-outline" size={12} color="#4b5563" />
                      <Text style={styles.workerBadgeText} numberOfLines={1}>{formattedWorker}</Text>
                    </View>
                  );
                }
                return null;
              })()}
              {bloqueadoPorOtro && (
                <View style={[styles.rutaBadge, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Ionicons name="person-outline" size={11} color="#dc2626" />
                  <Text style={[styles.rutaBadgeText, { color: '#dc2626' }]} numberOfLines={1}>{item.bloqueado_por_nombre || 'Otro'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const stats = {
    total: allClients.length,
    gestionados: allClients.filter(c => c.estado === 'VISITADO_PAGO').length,
  };

  // ── GUARDIA: Sin jornada iniciada, muestra pantalla de bloqueo ─
  const NoJornadaBanner = () => (
    <View style={styles.lockBanner}>
      <View style={[styles.lockIconContainer, { backgroundColor: enRefrigerio ? '#fef3c7' : '#F8FAFC' }]}>
        <Ionicons 
          name={enRefrigerio ? "restaurant" : "lock-closed"} 
          size={50} 
          color={enRefrigerio ? "#FFB300" : "#047CFD"} 
        />
      </View>
      <Text style={styles.lockTitle}>{enRefrigerio ? "En hora de almuerzo" : "Jornada no iniciada"}</Text>
      <Text style={styles.lockSub}>
        {enRefrigerio 
          ? `Tu jornada está pausada para descanso. \nRecupera fuerzas para continuar.`
          : "Debes iniciar tu jornada laboral para comenzar a visualizar y gestionar tu cartera de clientes de hoy."}
      </Text>
      
      {enRefrigerio && (
        <View style={styles.timerContainer}>
           <Ionicons name="time-outline" size={20} color="#f59e0b" />
           <Text style={styles.timerText}>{timerAlmuerzo}</Text>
        </View>
      )}

      {!enRefrigerio ? (
        <TouchableOpacity style={styles.lockBtn} onPress={() => setShowJourneyModal(true)}>
          <Ionicons name="play-circle" size={20} color="#fff" />
          <Text style={styles.lockBtnText}>INICIAR JORNADA</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={[styles.lockBtn, { backgroundColor: '#10b981' }]} 
          onPress={() => setShowJourneyModal(true)}
        >
          <Ionicons name="log-in" size={20} color="#fff" />
          <Text style={styles.lockBtnText}>RETORNAR A TRABAJAR</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const getJornadaCircleColor = () => {
    if (jornadaEstado === 'JORNADA_INICIADA') return '#10b981'; // Verde
    if (jornadaEstado === 'EN_REFRIGERIO') return '#f59e0b'; // Amarillo
    if (jornadaEstado === 'JORNADA_FINALIZADA') return '#a855f7'; // Púrpura
    return '#ffffff'; // Blanco (aún no inicia)
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar hidden={true} style="light" backgroundColor="#000000" translucent={true} />
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>InformaTech</Text>
              <TouchableOpacity onPress={() => navigation.navigate('DebugStorage')}>
                <Ionicons name="map" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowJourneyModal(true)}>
                <Ionicons name="time" size={24} color={enRefrigerio ? '#F59F00' : '#ffffff'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleClearCache}>
                <Ionicons name="file-tray-outline" size={22} color="#ffffff" opacity={0.8} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={logout}>
                <Ionicons name="log-out-outline" size={24} color="#ffb3b3" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
            <Text style={[styles.headerUser, !isOnline && { color: '#ef4444' }]}>
              {user?.nombres} • {isOnline ? 'Online' : 'Offline'}{user?.sede_nombre ? ` • ${user.sede_nombre}` : ''}
            </Text>
            <TouchableOpacity 
              style={[styles.jornadaCircle, { backgroundColor: getJornadaCircleColor() }]}
              onPress={() => setShowJourneyModal(true)}
            />
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="pin" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* FILTRO DROPDOWN RESTAURADO */}
        {puedeTrabajar && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>VISTA DE CLIENTES:</Text>
            <TouchableOpacity style={styles.filterSelector} onPress={() => setShowFilterModal(true)}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(filterStatus) }]} />
              <Text style={styles.filterValue}>
                {STATUS_OPTIONS.find(o => o.id === filterStatus)?.label}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#047CFD" />
            </TouchableOpacity>
          </View>
        )}

        {/* CONTENIDO PRINCIPAL */}
        {loading ? (
          <ActivityIndicator size="large" color="#047CFD" style={{ marginTop: 80 }} />
        ) : !jornadaEstado || finalizado || enRefrigerio ? (
          <NoJornadaBanner />
        ) : (
          <FlatList
            data={filteredClients}
            renderItem={renderClient}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(1, true); }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={hasMore ? <ActivityIndicator size="small" color="#047CFD" /> : null}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={50} color="#3F3F46" />
                <Text style={styles.emptyText}>No hay clientes encontrados.</Text>
              </View>
            }
          />
        )}

        {/* BOTON FLOTANTE (FAB) ELIMINADO SEGUN SOLICITUD */}

        {/* BOTTOM STATUS BAR (Reemplaza al filtro dropdown) */}
        {puedeTrabajar && !loading && !enRefrigerio && !finalizado && (
          <View style={styles.bottomFilterBar}>
            {STATUS_OPTIONS.map(opt => {
               const count = opt.id === 'TODOS' ? localClients.length : localClients.filter(c => c.estado === opt.id).length;
               const isActive = filterStatus === opt.id;
               return (
                 <TouchableOpacity 
                   key={opt.id} 
                   style={[styles.bottomFilterItem, { borderBottomColor: opt.color, borderBottomWidth: 5, opacity: 1 }]}
                   onPress={() => setFilterStatus(opt.id)}
                 >
                   <Text style={[styles.bottomFilterCount, isActive && { color: '#1A1A1A' }]}>{count}</Text>
                   <Text style={[styles.bottomFilterLabel, isActive && { color: '#1A1A1A', fontWeight: 'bold' }]}>{opt.label}</Text>
                 </TouchableOpacity>
               )
            })}
          </View>
        )}

        {MODELO_NEGOCIO === 'CAJA_HUANCAYO' && selectedClientIds.length > 0 && (
          <TouchableOpacity 
            style={styles.floatingBag}
            onPress={() => navigation.navigate('RutasTab')}
            activeOpacity={0.8}
          >
            <View style={styles.floatingBagContent}>
              <Ionicons name="briefcase" size={24} color="#FFF" />
              <View style={styles.floatingBagBadge}>
                <Text style={styles.floatingBagBadgeText}>{selectedClientIds.length}</Text>
              </View>
            </View>
            <Text style={styles.floatingBagLabel}>Ver mi Ruta</Text>
          </TouchableOpacity>
        )}

        {/* ── MODAL JORNADA ─────────────────────────────── */}
        <Modal visible={showJourneyModal} transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Control de Jornada</Text>

              {/* Estado actual */}
              <View style={[styles.estadoBox, {
                backgroundColor: '#F5F5F0',
                borderColor: jornadaEstado === 'JORNADA_INICIADA' ? '#0CA678' : '#E5E5E0',
                borderWidth: 1
              }]}>
                <Text style={[styles.estadoLabel, {
                  color: jornadaEstado === 'JORNADA_INICIADA' ? '#0CA678' : '#6B7280'
                }]}>
                  {jornadaEstado === 'JORNADA_INICIADA' ? 'Jornada activa' :
                   jornadaEstado === 'EN_REFRIGERIO' ? `En receso: ${timerAlmuerzo}` :
                   jornadaEstado === 'JORNADA_FINALIZADA' ? 'Día finalizado' :
                   'Sin iniciar'}
                </Text>
              </View>

              {/* Botones según estado */}
              <View style={styles.modalBtns}>
                  
                  {/* SI NO HAY JORNADA, SOLO MUESTRA INICIAR */}
                  {!jornadaEstado && (
                    <TouchableOpacity
                      style={[styles.mBtn, {
                        backgroundColor: '#047CFD',
                        borderColor: '#047CFD',
                        borderWidth: 1,
                      }]}
                      onPress={handleIniciarDia}
                      disabled={actionLoading}
                    >
                      <Ionicons name="play-circle" size={22} color="#fff" />
                      <Text style={[styles.mBtnText, { color: '#fff' }]}>
                        INICIAR DÍA
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* SI ESTA EN REFRIGERIO, SOLO MUESTRA FIN DE ALMUERZO */}
                  {enRefrigerio && (
                    <TouchableOpacity
                      style={[styles.mBtn, { backgroundColor: '#0CA678', borderWidth: 0 }]}
                      onPress={handleFinAlmuerzo}
                      disabled={actionLoading}
                    >
                      <Ionicons name="checkmark-done" size={22} color="#fff" />
                      <Text style={styles.mBtnText}>FIN DE ALMUERZO</Text>
                    </TouchableOpacity>
                  )}

                  {/* SI LA JORNADA ESTA INICIADA Y NO ESTA EN REFRIGERIO, MUESTRA ALMUERZO Y FIN DE DIA */}
                  {jornadaEstado === 'JORNADA_INICIADA' && !enRefrigerio && (
                    <>
                      <TouchableOpacity
                        style={[styles.mBtn, {
                          backgroundColor: '#FFF8E1',
                          borderColor: '#F59F00',
                          borderWidth: 1,
                        }]}
                        onPress={handleIniciarAlmuerzo}
                        disabled={actionLoading}
                      >
                        <Ionicons name="restaurant" size={20} color="#F59F00" />
                        <Text style={[styles.mBtnText, { color: '#F59F00' }]}>
                          INICIAR ALMUERZO
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.mBtn, {
                          backgroundColor: '#FEE2E2',
                          borderColor: '#EF4444',
                          borderWidth: 1,
                          marginTop: 4
                        }]}
                        onPress={handleFinalizarDia}
                        disabled={actionLoading}
                      >
                        <Ionicons name="stop-circle" size={20} color="#EF4444" />
                        <Text style={[styles.mBtnText, { color: '#EF4444' }]}>
                          FINALIZAR DÍA
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* SI LA JORNADA HA SIDO FINALIZADA */}
                  {jornadaEstado === 'JORNADA_FINALIZADA' && (
                    <View style={{ padding: 15, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' }}>
                      <Ionicons name="moon" size={24} color="#6B7280" style={{ marginBottom: 5 }} />
                      <Text style={{ color: '#6B7280', fontWeight: 'bold' }}>Tu jornada ha terminado por hoy.</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.mBtn, {
                      backgroundColor: 'transparent',
                      marginTop: 10
                    }]}
                    onPress={() => setShowJourneyModal(false)}
                  >
                    <Text style={[styles.mBtnText, { color: '#6B7280', fontWeight: 'bold' }]}>
                      CERRAR
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

        {/* MODAL FILTRO */}
        <Modal visible={showFilterModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtrar</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={28} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.filterOpt, filterStatus === opt.id && { backgroundColor: '#F0F0EB' }]}
                    onPress={() => { setFilterStatus(opt.id); setShowFilterModal(false); }}
                  >
                    <View style={[styles.statusDot, { backgroundColor: opt.color, width: 12, height: 12 }]} />
                    <Text style={[styles.filterOptText, filterStatus === opt.id && { color: '#1A1A1A', fontWeight: 'bold' }]}>
                      {opt.label}
                    </Text>
                    {filterStatus === opt.id && <Ionicons name="checkmark-circle" size={20} color="#047CFD" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 25, paddingTop: 30, paddingBottom: 25, backgroundColor: '#005dc3', borderBottomWidth: 0 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#ffffff' },
  headerUser: { fontSize: 13, color: '#e0e0e0', fontWeight: '600' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { marginLeft: 15, padding: 4 },
  jornadaCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  filterSection: { padding: 15, backgroundColor: '#F8FAFC' },
  filterLabel: { fontSize: 10, color: '#6B7280', fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
  filterSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E5E5E0' },
  filterValue: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginLeft: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 15, height: 46, borderRadius: 8, marginTop: 15 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1A1A1A' },
  list: { padding: 15, paddingBottom: 150 },
  clientCard: { backgroundColor: '#FFFFFF', borderRadius: 10, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: 15, marginBottom: 12, borderLeftWidth: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  clientSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  clientAddress: { fontSize: 14, color: '#1A1A1A', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 5 },
  clientIndex: { fontSize: 14, color: '#6B7280', width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#FFB300', textAlign: 'center', lineHeight: 22, fontWeight: 'bold' },
  clientDate: { fontSize: 12, color: '#6B7280' },
  fab: { position: 'absolute', bottom: 90, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  bottomFilterBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E5E0', paddingBottom: 10 },
  bottomFilterItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  bottomFilterCount: { fontSize: 16, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 },
  bottomFilterLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '600' },
  workerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 160 },
  workerBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  offlineTag: { backgroundColor: '#E03131', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  offlineTagText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  lockBanner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#F8FAFC' },
  lockIconContainer: { width: 100, height: 100, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 25, borderWidth: 1, borderColor: '#E5E5E0', backgroundColor: '#FFFFFF' },
  lockTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', marginBottom: 12, textAlign: 'center' },
  lockSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 25 },
  timerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: '#F59F00', marginBottom: 25, gap: 8 },
  timerText: { fontSize: 20, fontWeight: '900', color: '#D97706', fontVariant: ['tabular-nums'] },
  lockBtn: { backgroundColor: '#047CFD', flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 20, gap: 10 },
  lockBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#FFFFFF', width: '90%', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: '#E5E5E0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 20, textAlign: 'center' },
  estadoBox: { borderRadius: 16, padding: 16, marginBottom: 20, alignItems: 'center', backgroundColor: '#F5F5F0', borderColor: '#E5E5E0', borderWidth: 1 },
  estadoLabel: { fontSize: 14, fontWeight: '700' },
  modalBtns: { gap: 12 },
  mBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16 },
  mBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  closeBtn: { marginTop: 20, alignItems: 'center' },
  closeBtnText: { color: '#6B7280', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, paddingBottom: 50, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -5 }, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  filterOpt: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E5E0' },
  filterOptText: { flex: 1, marginLeft: 15, fontSize: 15, color: '#4B5563' },
  empty: { marginTop: 80, alignItems: 'center' },
  emptyText: { color: '#6B7280', marginTop: 10, fontSize: 15 },
  rutaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 160 },
  rutaBadgeText: { fontSize: 11, fontWeight: '700', color: '#047CFD' },
  // Bolsa flotante Caja Huancayo
  floatingBag: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    backgroundColor: '#D92B2B',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 9999,
  },
  floatingBagContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingBagBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  floatingBagBadgeText: {
    color: '#D92B2B',
    fontSize: 11,
    fontWeight: '900',
  },
  floatingBagLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
});
