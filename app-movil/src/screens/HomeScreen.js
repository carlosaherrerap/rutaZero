import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  Alert, ActivityIndicator, Dimensions, Modal, ScrollView, Platform
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { TrackingService } from '../services/TrackingService';

const { width } = Dimensions.get('window');

const STATUS_OPTIONS = [
  { id: 'TODOS', label: 'TODOS LOS CLIENTES', color: '#64748b' },
  { id: 'LIBRE', label: 'SOLO LIBRES', color: '#3b82f6' },
  { id: 'EN_VISITA', label: 'EN CAMINO', color: '#a855f7' },
  { id: 'VISITADO_PAGO', label: 'GESTIONADOS', color: '#10b981' },
  { id: 'REPROGRAMADO', label: 'REPROGRAMADOS', color: '#f59e0b' },
  { id: 'NO_ENCONTRADO', label: 'NO ENCONTRADOS', color: '#ef4444' },
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
  // Estado local de clientes para reflejar cambios offline en tiempo real
  const [localClients, setLocalClients] = useState([]);

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

  // Pantalla completa Android (Removido para usar Insets de forma nativa)
  useEffect(() => {
    // Ya no ocultamos la barra para que useSafeAreaInsets actúe correctamente
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
          if (pageNum === 1) setJourney(localData.journey);
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
          api.get(`/api/clientes?page=${pageNum}&limit=100&fecha_pago=${todayStr}`)
        ]);

        const freshJourney = resWorker.data.data;
        const rutasData = resRutas.data.data || [];
        const newData = resClients.data.data || [];
        
        setJourney(freshJourney);
        setHasMore(newData.length === 100);
        setAllClients(newData);
        setPage(pageNum);

        await saveDayData({
          journey: freshJourney, 
          clients: newData,
          rutas: rutasData
        });
        await logConnectionStatus('ONLINE');
      } else {
        const limit = 100;
        const resClients = await api.get(`/api/clientes?page=${pageNum}&limit=${limit}&fecha_pago=${todayStr}`);
        const newData = resClients.data.data || [];
        setHasMore(newData.length === limit);
        setAllClients(prev => [...prev, ...newData]);
        setPage(pageNum);
      }
    } catch (e) {
      console.log('❌ [Home] Error en fetchData:', e.message);
      const localData = await getDayData();
      if (localData) {
        if (pageNum === 1) setJourney(localData.journey);
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
    if (filterStatus === 'TODOS') setFilteredClients(localClients);
    else setFilteredClients(localClients.filter(c => c.estado === filterStatus));
  }, [filterStatus, localClients]);

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
      case 'EN_VISITA':     return '#a855f7';
      case 'VISITADO_PAGO': return '#10b981';
      case 'REPROGRAMADO':  return '#f59e0b';
      case 'NO_ENCONTRADO': return '#ef4444';
      default:              return '#00A9BC'; // Turquesa Eléctrico de la marca
    }
  };

  const renderClient = ({ item }) => {
    const isOfflinePending = pendingOfflineIds.includes(String(item.id));
    const estado = isOfflinePending ? (pendingStatuses[String(item.id)] || item.estado) : item.estado;
    const cardColor = getStatusColor(estado);
    
    // Bloquear: verificar si hay otro cliente ya en visita por este worker
    const clienteEnVisita = localClients.find(
      c => c.estado === 'EN_VISITA' && String(c.bloqueado_por) === String(user.id)
    );
    const esteEstaEnVisita = estado === 'EN_VISITA' && String(item.bloqueado_por) === String(user.id);
    const bloqueado = clienteEnVisita && !esteEstaEnVisita;

    return (
      <TouchableOpacity
        style={[styles.clientCard, { borderLeftColor: cardColor, opacity: bloqueado ? 0.55 : 1 }]}
        onPress={() => {
          if (!puedeTrabajar) {
            Alert.alert('Atención', 'Debes iniciar tu jornada para gestionar clientes.');
            return;
          }
          if (bloqueado) {
            Alert.alert(
              'Cliente en curso',
              `Ya tienes a "${clienteEnVisita.nombres} ${clienteEnVisita.apellidos}" en visita. Libera ese cliente antes de seleccionar otro.`
            );
            return;
          }
          navigation.navigate('DetalleCliente', { cliente: item });
        }}
      >
        <View style={styles.clientInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.clientName}>{item.nombres} {item.apellidos}</Text>
            {isOfflinePending && (
              <View style={styles.offlineTag}>
                <Ionicons name="cloud-offline" size={10} color="#fff" />
                <Text style={styles.offlineTagText}>OFFLINE</Text>
              </View>
            )}
          </View>
          <Text style={styles.clientAddress} numberOfLines={1}>{item.direccion}</Text>
          <Text style={styles.clientDebt}>Deuda: S/ {parseFloat(item.deuda_total || 0).toFixed(2)}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: cardColor + '15' }]}>
              <Text style={[styles.statusText, { color: cardColor }]}>{estado}</Text>
            </View>
            <Text style={styles.distritoText}>{item.distrito}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#00A9BC" />
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
          color={enRefrigerio ? "#f59e0b" : "#00A9BC"} 
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

  const JornadaBadge = () => {
    const colors = {
      JORNADA_INICIADA: '#10b981',
      EN_REFRIGERIO: '#f59e0b',
      JORNADA_FINALIZADA: '#94a3b8',
    };
    const labels = {
      JORNADA_INICIADA: 'Jornada activa',
      EN_REFRIGERIO: `Receso: ${timerAlmuerzo}`,
      JORNADA_FINALIZADA: 'Día finalizado',
    };
    const color = colors[jornadaEstado] || '#94a3b8';
    return (
      <View style={[styles.jornadaBadge, { borderColor: color }]}>
        <View style={[styles.jornadaDot, { backgroundColor: color }]} />
        <Text style={[styles.jornadaBadgeText, { color }]}>
          {labels[jornadaEstado] || 'Sin jornada'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>Routing</Text>
              <TouchableOpacity onPress={() => navigation.navigate('DebugStorage')}>
                <Ionicons name="bug" size={16} color="#00A9BC" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.headerUser, !isOnline && { color: '#ef4444' }]}>
              {user?.nombres} ({isOnline ? 'Online' : 'Offline'})
            </Text>
          </View>
          <View style={styles.headerIcons}>
            {jornadaEstado && <JornadaBadge />}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowJourneyModal(true)}>
              <Ionicons name="time" size={24} color={enRefrigerio ? '#f59e0b' : '#00A9BC'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleClearCache}>
              <Ionicons name="trash-outline" size={22} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTRO */}
        {puedeTrabajar && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>VISTA DE CLIENTES:</Text>
            <TouchableOpacity style={styles.filterSelector} onPress={() => setShowFilterModal(true)}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(filterStatus) }]} />
              <Text style={styles.filterValue}>
                {STATUS_OPTIONS.find(o => o.id === filterStatus)?.label}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#00A9BC" />
            </TouchableOpacity>
          </View>
        )}

        {/* CONTENIDO PRINCIPAL */}
        {loading ? (
          <ActivityIndicator size="large" color="#00A9BC" style={{ marginTop: 80 }} />
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
            ListFooterComponent={hasMore ? <ActivityIndicator size="small" color="#00A9BC" /> : null}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={50} color="#94a3b8" />
                <Text style={styles.emptyText}>No hay clientes con este filtro.</Text>
              </View>
            }
          />
        )}

        {/* ── MODAL JORNADA ─────────────────────────────── */}
        <Modal visible={showJourneyModal} transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Control de Jornada</Text>

              {/* Estado actual */}
              <View style={[styles.estadoBox, {
                backgroundColor:
                  jornadaEstado === 'JORNADA_INICIADA' ? '#F8FAFC' :
                  jornadaEstado === 'EN_REFRIGERIO' ? '#F8FAFC' :
                  jornadaEstado === 'JORNADA_FINALIZADA' ? '#F8FAFC' : '#F8FAFC',
                borderColor:
                  jornadaEstado === 'JORNADA_INICIADA' ? '#10b981' :
                  jornadaEstado === 'EN_REFRIGERIO' ? '#f59e0b' : '#E2E8F0',
                borderWidth: 1
              }]}>
                <Text style={[styles.estadoLabel, {
                  color:
                    jornadaEstado === 'JORNADA_INICIADA' ? '#10b981' :
                    jornadaEstado === 'EN_REFRIGERIO' ? '#f59e0b' : '#64748B'
                }]}>
                  {jornadaEstado === 'JORNADA_INICIADA' ? 'Jornada activa' :
                   jornadaEstado === 'EN_REFRIGERIO' ? `En receso: ${timerAlmuerzo}` :
                   jornadaEstado === 'JORNADA_FINALIZADA' ? 'Día finalizado' :
                   'Sin iniciar'}
                </Text>
              </View>

              {/* Botones según estado */}
              <View style={styles.modalBtns}>
                {/* INICIAR DÍA */}
                <TouchableOpacity
                  style={[styles.mBtn, {
                    backgroundColor: !jornadaEstado ? '#00A9BC' : '#F1F5F9',
                    borderColor: !jornadaEstado ? '#00A9BC' : '#E2E8F0',
                    borderWidth: 1,
                    opacity: !jornadaEstado ? 1 : 0.5
                  }]}
                  onPress={handleIniciarDia}
                  disabled={!!jornadaEstado || actionLoading}
                >
                  <Ionicons name="play-circle" size={20} color={!jornadaEstado ? '#fff' : '#64748b'} />
                  <Text style={[styles.mBtnText, { color: !jornadaEstado ? '#fff' : '#64748b' }]}>
                    INICIAR DÍA
                  </Text>
                </TouchableOpacity>

                {/* ALMUERZO / FIN ALMUERZO */}
                {enRefrigerio ? (
                  <TouchableOpacity
                    style={[styles.mBtn, { backgroundColor: '#10b981', borderWidth: 0 }]}
                    onPress={handleFinAlmuerzo}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.mBtnText}>FIN DE ALMUERZO</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.mBtn, {
                      backgroundColor: 'transparent',
                      borderColor: '#f59e0b',
                      borderWidth: 1,
                      opacity: jornadaEstado === 'JORNADA_INICIADA' ? 1 : 0.5
                    }]}
                    onPress={handleIniciarAlmuerzo}
                    disabled={jornadaEstado !== 'JORNADA_INICIADA' || actionLoading}
                  >
                    <Ionicons name="restaurant" size={20} color="#f59e0b" />
                    <Text style={[styles.mBtnText, { color: '#f59e0b' }]}>
                      ALMUERZO
                    </Text>
                  </TouchableOpacity>
                )}

                {/* FINALIZAR DÍA */}
                <TouchableOpacity
                  style={[styles.mBtn, {
                    backgroundColor: 'transparent',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    opacity: jornadaEstado === 'JORNADA_INICIADA' ? 1 : 0.5
                  }]}
                  onPress={handleFinalizarDia}
                  disabled={jornadaEstado !== 'JORNADA_INICIADA' || actionLoading}
                >
                  <Ionicons name="stop-circle" size={20} color="#ef4444" />
                  <Text style={[styles.mBtnText, { color: '#ef4444' }]}>
                    FINALIZAR DÍA
                  </Text>
                </TouchableOpacity>
              </View>

              {actionLoading && <ActivityIndicator color="#00A9BC" style={{ marginTop: 10 }} />}

              <TouchableOpacity onPress={() => setShowJourneyModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>CERRAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL FILTRO */}
        <Modal visible={showFilterModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtrar Gestión</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                  <Ionicons name="close" size={28} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.filterOpt, filterStatus === opt.id && styles.filterOptActive]}
                    onPress={() => { setFilterStatus(opt.id); setShowFilterModal(false); }}
                  >
                    <View style={[styles.statusDot, { backgroundColor: opt.color, width: 12, height: 12 }]} />
                    <Text style={[styles.filterOptText, filterStatus === opt.id && { color: '#00A9BC', fontWeight: 'bold' }]}>
                      {opt.label}
                    </Text>
                    {filterStatus === opt.id && <Ionicons name="checkmark-circle" size={20} color="#00A9BC" />}
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
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 },
  headerUser: { fontSize: 12, color: '#00A9BC', fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { marginLeft: 10, padding: 4 },
  jornadaBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, gap: 5, marginRight: 6 },
  jornadaDot: { width: 6, height: 6, borderRadius: 3 },
  jornadaBadgeText: { fontSize: 10, fontWeight: '800' },
  filterSection: { padding: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filterLabel: { fontSize: 10, color: '#64748B', fontWeight: 'bold', marginBottom: 5 },
  filterSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  filterValue: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E293B' },
  list: { padding: 15, paddingBottom: 100 },
  clientCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    borderLeftWidth: 5, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  clientAddress: { fontSize: 12, color: '#64748B', marginTop: 4 },
  clientDebt: { fontSize: 12, color: '#ef4444', fontWeight: '700', marginTop: 3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 10 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  distritoText: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  offlineTag: { backgroundColor: '#FF6B6B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  offlineTagText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  // Lock banner
  lockBanner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#F8FAFC' },
  lockIconContainer: { 
    width: 100, height: 100, 
    borderRadius: 50, 
    justifyContent: 'center', alignItems: 'center', 
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginBottom: 12, textAlign: 'center' },
  lockSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 25 },
  timerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', marginBottom: 25, gap: 8 },
  timerText: { fontSize: 20, fontWeight: '900', color: '#f59e0b', fontVariant: ['tabular-nums'] },
  lockBtn: { 
    backgroundColor: '#00A9BC', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 28, 
    borderRadius: 16, 
    gap: 10, 
  },
  lockBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  // Modal Jornada
  modalBg: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.75)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { 
    backgroundColor: '#FFFFFF', 
    width: '88%', 
    borderRadius: 28, 
    padding: 28, 
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 16, textAlign: 'center' },
  estadoBox: { borderRadius: 16, padding: 14, marginBottom: 20, alignItems: 'center' },
  estadoLabel: { fontSize: 14, fontWeight: '700' },
  modalBtns: { gap: 12 },
  mBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, borderRadius: 14 },
  mBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  closeBtn: { marginTop: 20, alignItems: 'center' },
  closeBtnText: { color: '#64748B', fontWeight: 'bold' },
  // Modal filtro
  modalOverlay: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.75)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 25, 
    paddingBottom: 50,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  filterOpt: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filterOptActive: { backgroundColor: '#F1F5F9' },
  filterOptText: { flex: 1, marginLeft: 15, fontSize: 14, color: '#64748B' },
  // Empty
  empty: { marginTop: 80, alignItems: 'center' },
  emptyText: { color: '#64748B', marginTop: 10, fontSize: 15 },
});
