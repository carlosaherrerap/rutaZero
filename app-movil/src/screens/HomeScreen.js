import React, { useState, useContext, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  Alert, ActivityIndicator, Dimensions, Modal, ScrollView, Platform
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const STATUS_OPTIONS = [
  { id: 'TODOS', label: 'TODOS LOS CLIENTES', color: '#64748b' },
  { id: 'LIBRE', label: 'SOLO LIBRES', color: '#3b82f6' },
  { id: 'EN_VISITA', label: 'EN CAMINO', color: '#a855f7' },
  { id: 'VISITADO_PAGO', label: 'GESTIONADOS', color: '#10b981' },
  { id: 'REPROGRAMADO', label: 'REPROGRAMADOS', color: '#f59e0b' },
  { id: 'NO_ENCONTRADO', label: 'NO ENCONTRADOS', color: '#ef4444' },
];

import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen({ navigation }) {
  const { api, user, logout } = useContext(AuthContext);
  const [journey, setJourney] = useState(null);
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Detector de Conexión y Sincronización
  useEffect(() => {
    const { addEventListener } = require('@react-native-community/netinfo');
    const { initOfflineDB, syncPendingFichas, clearOfflineCache } = require('../services/OfflineService');

    // 1. Limpiar caché al iniciar app
    clearOfflineCache();

    // 2. Inicializar DB Local
    initOfflineDB();

    const unsubscribe = addEventListener(state => {
      setIsOnline(state.isConnected);
      // 3. Si vuelve el internet, sincronizar lo que esté pendiente
      if (state.isConnected && api) {
        syncPendingFichas(api);
      }
    });

    // 4. Sincronización periódica cada 10 minutos por seguridad
    const interval = setInterval(() => {
      if (isOnline && api) syncPendingFichas(api);
    }, 1000 * 60 * 10);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [api, isOnline]);
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('TODOS');
  
  // MODO PANTALLA COMPLETA (Contexto Punto 28)
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Configuración inmersiva sin avisos de incompatibilidad
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-pan'); 
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Estado de jornada
      const resWorker = await api.get(`/api/workers/${user.id}`);
      setJourney(resWorker.data.data);

      // 2. Todos los clientes de la base de datos (Contexto punto 10)
      const resClients = await api.get('/api/clientes?limit=500');
      const data = resClients.data.data || [];
      setAllClients(data);
    } catch (e) {
      console.log('[Home] Error fetching data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, api]);

  // Refresco automático al entrar a la pantalla (Punto 29 Contexto)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Filtro por Spinner (Contexto punto 27)
  useEffect(() => {
    if (filterStatus === 'TODOS') {
      setFilteredClients(allClients);
    } else {
      setFilteredClients(allClients.filter(c => c.estado === filterStatus));
    }
  }, [filterStatus, allClients]);

  const handleAction = async (endpoint, nextStatus, msg) => {
    setLoading(true);
    try {
      await api.post(`/api/workers/jornada/${endpoint}`);
      setJourney(prev => ({ ...prev, estado_jornada: nextStatus }));
      setShowJourneyModal(false);
      Alert.alert('Aviso', msg);
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'EN_VISITA': return '#a855f7';
      case 'VISITADO_PAGO': return '#10b981';
      case 'REPROGRAMADO': return '#f59e0b';
      case 'NO_ENCONTRADO': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  const renderClient = ({ item }) => {
    const cardColor = getStatusColor(item.estado);
    return (
      <TouchableOpacity 
        style={[styles.clientCard, { borderLeftColor: cardColor }]}
        onPress={() => navigation.navigate('DetalleCliente', { cliente: item })}
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
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowJourneyModal(true)}>
                 <Ionicons name="time" size={24} color={journey?.estado_jornada === 'EN_REFRIGERIO' ? '#f59e0b' : '#3b82f6'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={logout}>
                 <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
           </View>
        </View>

        {/* FILTRO TÁCTICO (Contexto Punto 27) */}
        <View style={styles.filterSection}>
           <Text style={styles.filterLabel}>VISTA DE CLIENTES:</Text>
           <TouchableOpacity 
             style={styles.filterSelector} 
             onPress={() => setShowFilterModal(true)}
           >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(filterStatus) }]} />
              <Text style={styles.filterValue}>
                {STATUS_OPTIONS.find(o => o.id === filterStatus)?.label}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#94a3b8" />
           </TouchableOpacity>
        </View>

        {/* LISTA GLOBAL */}
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

        {/* MENÚ INFERIOR DE STATS (Punto 11 Contexto) */}
        <View style={styles.tabBar}>
           <TouchableOpacity style={styles.tabItem} onPress={() => setFilterStatus('TODOS')}>
              <Ionicons name="people" size={24} color={filterStatus === 'TODOS' ? '#3b82f6' : '#94a3b8'} />
              <Text style={[styles.tabLabel, filterStatus === 'TODOS' && { color: '#3b82f6' }]}>{stats.total}</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Ruta')}>
              <Ionicons name="map" size={24} color="#94a3b8" />
              <Text style={styles.tabLabel}>MIS RUTAS</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.tabItem} onPress={() => setFilterStatus('NO_ENCONTRADO')}>
              <Ionicons name="alert-circle" size={24} color={filterStatus === 'NO_ENCONTRADO' ? '#ef4444' : '#94a3b8'} />
              <Text style={[styles.tabLabel, filterStatus === 'NO_ENCONTRADO' && { color: '#ef4444' }]}>{stats.noEncontrados}</Text>
           </TouchableOpacity>
        </View>

        {/* MODAL JORNADA */}
        <Modal visible={showJourneyModal} transparent animationType="fade">
           <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                 <Text style={styles.modalTitle}>Control de Asistencia</Text>
                 <Text style={styles.statusCurrent}>Estado: {journey?.estado_jornada || 'INACTIVO'}</Text>
                 <View style={styles.modalBtns}>
                    <TouchableOpacity style={[styles.mBtn, { backgroundColor: '#10b981' }]} onPress={() => handleAction('iniciar', 'JORNADA_INICIADA', 'Iniciado')}>
                       <Text style={styles.mBtnText}>INICIAR DÍA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mBtn, { backgroundColor: '#f59e0b' }]} onPress={() => handleAction('almuerzo/inicio', 'EN_REFRIGERIO', 'Provecho')}>
                       <Text style={styles.mBtnText}>ALMUERZO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mBtn, { backgroundColor: '#ef4444' }]} onPress={() => handleAction('finalizar', 'JORNADA_FINALIZADA', 'Terminado')}>
                       <Text style={styles.mBtnText}>FIN DÍA</Text>
                    </TouchableOpacity>
                 </View>
                 <TouchableOpacity onPress={() => setShowJourneyModal(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>CERRAR</Text>
                 </TouchableOpacity>
              </View>
           </View>
        </Modal>

        {/* MODAL FILTRO TÁCTICO */}
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
                        onPress={() => {
                          setFilterStatus(opt.id);
                          setShowFilterModal(false);
                        }}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  headerUser: { fontSize: 12, color: '#10b981', fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  iconBtn: { marginLeft: 15 },
  filterSection: { padding: 15, backgroundColor: '#fff' },
  filterLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', marginBottom: 5 },
  pickerContainer: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  picker: { height: 50, width: '100%' },
  list: { padding: 15, paddingBottom: 100 },
  clientCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 12, borderLeftWidth: 5, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  clientAddress: { fontSize: 12, color: '#64748b', marginTop: 3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginRight: 10 },
  statusText: { fontSize: 9, fontWeight: '800' },
  distritoText: { fontSize: 10, color: '#94a3b8' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  filterSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  filterValue: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1e293b' },
  filterOpt: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterOptActive: { backgroundColor: '#eff6ff' },
  filterOptText: { flex: 1, marginLeft: 15, fontSize: 14, color: '#475569' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, paddingBottom: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 75, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 20 },
  tabItem: { alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', width: '85%', borderRadius: 25, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  statusCurrent: { color: '#64748b', marginBottom: 20 },
  modalBtns: { width: '100%', gap: 10 },
  mBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  mBtnText: { color: '#fff', fontWeight: 'bold' },
  closeBtn: { marginTop: 20 },
  closeBtnText: { color: '#94a3b8', fontWeight: 'bold' }
});
