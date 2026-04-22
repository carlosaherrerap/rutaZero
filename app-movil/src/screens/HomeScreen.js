import React, { useState, useContext, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  Alert, ActivityIndicator, Dimensions, Modal, ScrollView
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
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

export default function HomeScreen({ navigation }) {
  const { api, user, logout, journey, setJourney } = useContext(AuthContext);
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('TODOS');

  // Modo Pantalla Completa (Contexto: Quitar barra inferior)
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('inset-touch');
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
      setFilteredClients(data);
    } catch (e) {
      console.log('[Home] Error fetching data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtro por Spinner (Contexto punto 27)
  useEffect(() => {
    if (filterStatus === 'TODOS') {
      setFilteredClients(allClients);
    } else {
      setFilteredClients(allClients.filter(c => c.estado === filterStatus));
    }
  }, [filterStatus, allClients]);

  const handleAction = async (endpoint, msg) => {
    setLoading(true);
    try {
      const res = await api.post(`/api/workers/jornada/${endpoint}`);
      setJourney(res.data.data);
      setShowJourneyModal(false);
      Alert.alert('Asistencia', msg);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Error de conexión');
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
              <Text style={styles.headerUser}>{user?.nombres} (Online)</Text>
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
                    <TouchableOpacity 
                       style={[styles.mBtn, { backgroundColor: '#10b981' }, journey?.estado_jornada && styles.btnDisabled]} 
                       onPress={() => handleAction('iniciar', 'Día Iniciado')}
                       disabled={!!journey?.estado_jornada}
                    >
                       <Text style={styles.mBtnText}>{journey?.estado_jornada ? 'DÍA YA INICIADO' : 'INICIAR DÍA'}</Text>
                    </TouchableOpacity>

                    {journey?.estado_jornada === 'EN_REFRIGERIO' ? (
                       <TouchableOpacity 
                          style={[styles.mBtn, { backgroundColor: '#3b82f6' }]} 
                          onPress={() => handleAction('almuerzo/fin', 'Bienvenido de vuelta')}
                       >
                          <Text style={styles.mBtnText}>VOLVER DE ALMUERZO</Text>
                       </TouchableOpacity>
                    ) : (
                       <TouchableOpacity 
                          style={[styles.mBtn, { backgroundColor: '#f59e0b' }, journey?.estado_jornada !== 'JORNADA_INICIADA' && styles.btnDisabled]} 
                          onPress={() => handleAction('almuerzo/inicio', 'Buen provecho')}
                          disabled={journey?.estado_jornada !== 'JORNADA_INICIADA'}
                       >
                          <Text style={styles.mBtnText}>IR A ALMUERZO</Text>
                       </TouchableOpacity>
                    )}

                    <TouchableOpacity 
                       style={[styles.mBtn, { backgroundColor: '#ef4444' }, journey?.estado_jornada === 'JORNADA_FINALIZADA' && styles.btnDisabled]} 
                       onPress={() => handleAction('finalizar', 'Jornada terminada')}
                       disabled={journey?.estado_jornada === 'JORNADA_FINALIZADA'}
                    >
                       <Text style={styles.mBtnText}>FIN DE JORNADA</Text>
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
