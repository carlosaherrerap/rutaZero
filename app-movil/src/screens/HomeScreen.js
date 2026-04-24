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
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
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

  // Cronómetro de almuerzo (corre solo si estado es EN_REFRIGERIO)
  const almuerzoStart = journey?.estado_jornada === 'EN_REFRIGERIO' ? journey?.hora_inicio_almuerzo : null;
  const timerAlmuerzo = useCronometro(almuerzoStart);

  // Detector de conexión
  useEffect(() => {
    const { addEventListener } = require('@react-native-community/netinfo');
    const { initOfflineDB, syncPendingFichas, clearOfflineCache } = require('../services/OfflineService');
    clearOfflineCache();
    initOfflineDB();
    const unsubscribe = addEventListener(state => {
      setIsOnline(state.isConnected);
      if (state.isConnected && api) syncPendingFichas(api);
    });
    const interval = setInterval(() => {
      if (isOnline && api) syncPendingFichas(api);
    }, 1000 * 60 * 10);
    return () => { unsubscribe(); clearInterval(interval); };
  }, [api, isOnline]);

  // Pantalla completa Android
  useEffect(() => {
    if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden');
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [resWorker, resClients] = await Promise.all([
        api.get(`/api/workers/${user.id}`),
        api.get('/api/clientes?limit=500&estado_excluir=VISITADO_PAGO,REPROGRAMADO,NO_ENCONTRADO')
      ]);
      setJourney(resWorker.data.data);
      const data = resClients.data.data || [];
      setAllClients(data);
    } catch (e) {
      console.log('[Home] Error fetching data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, api]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  useEffect(() => {
    if (filterStatus === 'TODOS') setFilteredClients(allClients);
    else setFilteredClients(allClients.filter(c => c.estado === filterStatus));
  }, [filterStatus, allClients]);

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
      try {
        await api.post('/api/workers/jornada/iniciar');
        await fetchData();
        setShowJourneyModal(false);
        Alert.alert('¡Listo!', 'Jornada iniciada. ¡Buen día!');
      } catch (e) {
        Alert.alert('Error', 'No se pudo iniciar la jornada.');
      } finally { setActionLoading(false); }
    });
  };

  const handleIniciarAlmuerzo = () => {
    confirmarAccion('Receso', '¿Deseas empezar tu receso?', async () => {
      setActionLoading(true);
      try {
        await api.post('/api/workers/jornada/almuerzo/inicio');
        await fetchData();
      } catch (e) {
        Alert.alert('Error', 'No se pudo iniciar el receso.');
      } finally { setActionLoading(false); }
    });
  };

  const handleFinAlmuerzo = () => {
    confirmarAccion('Fin de Receso', '¿Deseas finalizar tu receso?', async () => {
      setActionLoading(true);
      try {
        await api.post('/api/workers/jornada/almuerzo/fin');
        await fetchData();
      } catch (e) {
        Alert.alert('Error', 'No se pudo finalizar el receso.');
      } finally { setActionLoading(false); }
    });
  };

  const handleFinalizarDia = () => {
    confirmarAccion('Finalizar Día', '¿Deseas finalizar tu día laboral?', async () => {
      setActionLoading(true);
      try {
        await api.post('/api/workers/jornada/finalizar');
        await fetchData();
        setShowJourneyModal(false);
        Alert.alert('¡Hasta mañana!', 'Jornada finalizada correctamente.');
      } catch (e) {
        Alert.alert('Error', 'No se pudo finalizar la jornada.');
      } finally { setActionLoading(false); }
    });
  };

  // ── RENDER CLIENTE ──────────────────────────────────────────
  const getStatusColor = (estado) => {
    switch (estado) {
      case 'EN_VISITA':     return '#a855f7';
      case 'VISITADO_PAGO': return '#10b981';
      case 'REPROGRAMADO':  return '#f59e0b';
      case 'NO_ENCONTRADO': return '#ef4444';
      default:              return '#3b82f6';
    }
  };

  const renderClient = ({ item }) => {
    const cardColor = getStatusColor(item.estado);
    return (
      <TouchableOpacity
        style={[styles.clientCard, { borderLeftColor: cardColor }]}
        onPress={() => {
          if (!puedeTrabajar) {
            Alert.alert('Atención', 'Debes iniciar tu jornada para gestionar clientes.');
            return;
          }
          navigation.navigate('DetalleCliente', { cliente: item });
        }}
      >
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.nombres} {item.apellidos}</Text>
          <Text style={styles.clientAddress} numberOfLines={1}>{item.direccion}</Text>
          <Text style={styles.clientDebt}>Deuda: S/ {parseFloat(item.deuda_total || 0).toFixed(2)}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: cardColor + '15' }]}>
              <Text style={[styles.statusText, { color: cardColor }]}>{item.estado}</Text>
            </View>
            <Text style={styles.distritoText}>{item.distrito}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      </TouchableOpacity>
    );
  };

  const stats = {
    total: allClients.length,
    gestionados: allClients.filter(c => c.estado === 'VISITADO_PAGO').length,
    noEncontrados: allClients.filter(c => c.estado === 'NO_ENCONTRADO').length,
  };

  // ── GUARDIA: Sin jornada iniciada, muestra pantalla de bloqueo ─
  const NoJornadaBanner = () => (
    <View style={styles.lockBanner}>
      <Ionicons name="lock-closed" size={50} color="#cbd5e1" />
      <Text style={styles.lockTitle}>Jornada no iniciada</Text>
      <Text style={styles.lockSub}>Presiona INICIAR DÍA para comenzar a gestionar clientes.</Text>
      <TouchableOpacity style={styles.lockBtn} onPress={() => setShowJourneyModal(true)}>
        <Ionicons name="play-circle" size={20} color="#fff" />
        <Text style={styles.lockBtnText}>INICIAR DÍA</Text>
      </TouchableOpacity>
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
            <Text style={styles.headerTitle}>Ruta Zero</Text>
            <Text style={[styles.headerUser, !isOnline && { color: '#ef4444' }]}>
              {user?.nombres} ({isOnline ? 'Online' : 'Offline'})
            </Text>
          </View>
          <View style={styles.headerIcons}>
            {jornadaEstado && <JornadaBadge />}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowJourneyModal(true)}>
              <Ionicons name="time" size={24} color={enRefrigerio ? '#f59e0b' : '#3b82f6'} />
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
              <Ionicons name="chevron-down" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        {/* CONTENIDO PRINCIPAL */}
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 80 }} />
        ) : !jornadaEstado || finalizado ? (
          <NoJornadaBanner />
        ) : (
          <FlatList
            data={filteredClients}
            renderItem={renderClient}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={50} color="#cbd5e1" />
                <Text style={styles.emptyText}>No hay clientes con este filtro.</Text>
              </View>
            }
          />
        )}

        {/* TAB BAR */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => setFilterStatus('TODOS')}>
            <Ionicons name="people" size={24} color={filterStatus === 'TODOS' ? '#3b82f6' : '#94a3b8'} />
            <Text style={[styles.tabLabel, filterStatus === 'TODOS' && { color: '#3b82f6' }]}>{stats.total}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Ruta')}>
            <Ionicons name="map" size={24} color="#94a3b8" />
            <Text style={styles.tabLabel}>MIS RUTAS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Asistencia')}>
            <Ionicons name="calendar" size={24} color="#94a3b8" />
            <Text style={styles.tabLabel}>ASISTENCIA</Text>
          </TouchableOpacity>
        </View>

        {/* ── MODAL JORNADA ─────────────────────────────── */}
        <Modal visible={showJourneyModal} transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Control de Jornada</Text>

              {/* Estado actual */}
              <View style={[styles.estadoBox, {
                backgroundColor:
                  jornadaEstado === 'JORNADA_INICIADA' ? '#d1fae5' :
                  jornadaEstado === 'EN_REFRIGERIO' ? '#fef3c7' :
                  jornadaEstado === 'JORNADA_FINALIZADA' ? '#f1f5f9' : '#f8fafc'
              }]}>
                <Text style={styles.estadoLabel}>
                  {jornadaEstado === 'JORNADA_INICIADA' ? '✅ Jornada activa' :
                   jornadaEstado === 'EN_REFRIGERIO' ? `🍽️ En receso: ${timerAlmuerzo}` :
                   jornadaEstado === 'JORNADA_FINALIZADA' ? '🔒 Día finalizado' :
                   '⏳ Sin iniciar'}
                </Text>
              </View>

              {/* Botones según estado */}
              <View style={styles.modalBtns}>
                {/* INICIAR DÍA */}
                <TouchableOpacity
                  style={[styles.mBtn, {
                    backgroundColor: !jornadaEstado ? '#10b981' : '#e2e8f0',
                    opacity: !jornadaEstado ? 1 : 0.5
                  }]}
                  onPress={handleIniciarDia}
                  disabled={!!jornadaEstado || actionLoading}
                >
                  <Ionicons name="play-circle" size={20} color={!jornadaEstado ? '#fff' : '#94a3b8'} />
                  <Text style={[styles.mBtnText, { color: !jornadaEstado ? '#fff' : '#94a3b8' }]}>
                    INICIAR DÍA
                  </Text>
                </TouchableOpacity>

                {/* ALMUERZO / FIN ALMUERZO */}
                {enRefrigerio ? (
                  <TouchableOpacity
                    style={[styles.mBtn, { backgroundColor: '#10b981' }]}
                    onPress={handleFinAlmuerzo}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.mBtnText}>FIN DE ALMUERZO</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.mBtn, {
                      backgroundColor: jornadaEstado === 'JORNADA_INICIADA' ? '#f59e0b' : '#e2e8f0',
                      opacity: jornadaEstado === 'JORNADA_INICIADA' ? 1 : 0.5
                    }]}
                    onPress={handleIniciarAlmuerzo}
                    disabled={jornadaEstado !== 'JORNADA_INICIADA' || actionLoading}
                  >
                    <Ionicons name="restaurant" size={20} color={jornadaEstado === 'JORNADA_INICIADA' ? '#fff' : '#94a3b8'} />
                    <Text style={[styles.mBtnText, { color: jornadaEstado === 'JORNADA_INICIADA' ? '#fff' : '#94a3b8' }]}>
                      ALMUERZO
                    </Text>
                  </TouchableOpacity>
                )}

                {/* FINALIZAR DÍA */}
                <TouchableOpacity
                  style={[styles.mBtn, {
                    backgroundColor: jornadaEstado === 'JORNADA_INICIADA' ? '#ef4444' : '#e2e8f0',
                    opacity: jornadaEstado === 'JORNADA_INICIADA' ? 1 : 0.5
                  }]}
                  onPress={handleFinalizarDia}
                  disabled={jornadaEstado !== 'JORNADA_INICIADA' || actionLoading}
                >
                  <Ionicons name="stop-circle" size={20} color={jornadaEstado === 'JORNADA_INICIADA' ? '#fff' : '#94a3b8'} />
                  <Text style={[styles.mBtnText, { color: jornadaEstado === 'JORNADA_INICIADA' ? '#fff' : '#94a3b8' }]}>
                    FINALIZAR DÍA
                  </Text>
                </TouchableOpacity>
              </View>

              {actionLoading && <ActivityIndicator color="#3b82f6" style={{ marginTop: 10 }} />}

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
                  <Ionicons name="close" size={28} color="#64748b" />
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
                    <Text style={[styles.filterOptText, filterStatus === opt.id && { color: '#3b82f6', fontWeight: 'bold' }]}>
                      {opt.label}
                    </Text>
                    {filterStatus === opt.id && <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />}
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  headerUser: { fontSize: 12, color: '#10b981', fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { marginLeft: 10 },
  jornadaBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, gap: 5, marginRight: 6 },
  jornadaDot: { width: 6, height: 6, borderRadius: 3 },
  jornadaBadgeText: { fontSize: 10, fontWeight: '800' },
  filterSection: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', marginBottom: 5 },
  filterSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  filterValue: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1e293b' },
  list: { padding: 15, paddingBottom: 100 },
  clientCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 12, borderLeftWidth: 5, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  clientAddress: { fontSize: 12, color: '#64748b', marginTop: 3 },
  clientDebt: { fontSize: 11, color: '#ef4444', fontWeight: '600', marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginRight: 10 },
  statusText: { fontSize: 9, fontWeight: '800' },
  distritoText: { fontSize: 10, color: '#94a3b8' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  // Lock banner
  lockBanner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  lockTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  lockSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#3b82f6', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, marginTop: 16, elevation: 3 },
  lockBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  // Tab
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 75, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 20 },
  tabItem: { alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 4 },
  // Modal Jornada
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', width: '88%', borderRadius: 28, padding: 28, alignItems: 'stretch' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 14, textAlign: 'center' },
  estadoBox: { borderRadius: 16, padding: 14, marginBottom: 20, alignItems: 'center' },
  estadoLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalBtns: { gap: 10 },
  mBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, borderRadius: 14 },
  mBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  closeBtn: { marginTop: 20, alignItems: 'center' },
  closeBtnText: { color: '#94a3b8', fontWeight: 'bold' },
  // Modal filtro
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, paddingBottom: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  filterOpt: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterOptActive: { backgroundColor: '#eff6ff' },
  filterOptText: { flex: 1, marginLeft: 15, fontSize: 14, color: '#475569' },
  // Empty
  empty: { marginTop: 80, alignItems: 'center' },
  emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 15 },
});
