import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MODELO_NEGOCIO } from '../config';

const RutaScreen = ({ navigation }) => {
  const { api, user } = useContext(AuthContext);
  const [groupedRutas, setGroupedRutas] = useState([]);
  const [flatClients, setFlatClients] = useState([]);
  const [activeRutaId, setActiveRutaId] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [jornadaEstado, setJornadaEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const { getDayData, logConnectionStatus } = require('../services/OfflineService');
    
    // Check connection
    const net = await require('@react-native-community/netinfo').fetch();
    const online = net.isConnected;
    setIsOnline(online);

    try {
      if (!online) {
        const localData = await getDayData();
        if (localData) {
          setJornadaEstado(localData.journey?.estado_jornada);
          processRutas(localData.rutas || []);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [resWorker, resRutas] = await Promise.all([
        api.get(`/api/workers/${user.id}`),
        api.get('/api/workers/me/ruta')
      ]);
      setJornadaEstado(resWorker.data.data.estado_jornada);
      processRutas(resRutas.data.data || []);
    } catch (e) {
      console.log('[Ruta] Error fetching routes', e);
      const localData = await getDayData();
      if (localData) {
        setJornadaEstado(localData.journey?.estado_jornada);
        processRutas(localData.rutas || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, user]);

  const processRutas = (rawData) => {
    if (MODELO_NEGOCIO === 'CAJA_HUANCAYO') {
      // flat list of clients
      const clientsList = rawData.map(item => ({
        ...item,
        id: item.cliente_id || item.id
      })).filter(item => item.id && item.id !== 'null');
      
      // Sort by orden ascending
      clientsList.sort((a, b) => (parseInt(a.orden) || 0) - (parseInt(b.orden) || 0));
      setFlatClients(clientsList);
      
      const firstRuta = rawData.find(item => item.ruta_id);
      if (firstRuta) {
        setActiveRutaId(firstRuta.ruta_id);
      }
    } else {
      const groups = rawData.reduce((acc, item) => {
        const key = item.ruta_id;
        if (!key) return acc;
        if (!acc[key]) {
          acc[key] = {
            id: key,
            nombre: item.ruta_nombre || 'Ruta General',
            fecha: item.fecha_asignacion,
            clientes: [],
            visitados: 0
          };
        }
        if (item.cliente_id) {
          acc[key].clientes.push(item);
          if (item.cliente_estado && item.cliente_estado !== 'LIBRE') {
            acc[key].visitados++;
          }
        }
        return acc;
      }, {});
      setGroupedRutas(Object.values(groups));
    }
  };

  const handleMoveItem = async (index, direction) => {
    const newItems = [...flatClients];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    
    // Swap items
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    
    // Update state
    setFlatClients(newItems);
    
    // Save order to backend
    if (activeRutaId && isOnline && api) {
      try {
        const orderedIds = newItems.map(c => c.cliente_id || c.id);
        await api.patch(`/api/rutas/${activeRutaId}/ordenar`, { cliente_ids: orderedIds });
        console.log('✅ Orden de ruta guardado en servidor');
      } catch (err) {
        console.warn('⚠️ Error guardando orden en servidor:', err.message);
      }
    }
    
    // Save to local offline cache
    try {
      const { getDayData, saveDayData } = require('../services/OfflineService');
      const cached = await getDayData();
      if (cached) {
        // Re-map flatClients to cached.rutas
        const remappedRutas = newItems.map((item, idx) => ({
          ...item,
          orden: idx + 1
        }));
        cached.rutas = remappedRutas;
        await saveDayData(cached);
      }
    } catch (err) {
      console.warn('⚠️ Error guardando orden local:', err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  const enRefrigerio = jornadaEstado === 'EN_REFRIGERIO';
  const puedeTrabajar = jornadaEstado === 'JORNADA_INICIADA';
  const finalizado = jornadaEstado === 'JORNADA_FINALIZADA';

  const renderRutaCard = ({ item }) => {
    const progress = item.clientes.length > 0 ? Math.round((item.visitados / item.clientes.length) * 100) : 0;
    const isCompleted = item.clientes.length > 0 && item.visitados === item.clientes.length;

    return (
      <TouchableOpacity 
        style={[styles.rutaCard, isCompleted && styles.rutaCardCompleted]} 
        onPress={() => navigation.navigate('RutaDetalle', { ruta: item })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
           <View style={styles.iconContainer}>
              <Ionicons name="map" size={24} color="#00A9BC" />
           </View>
           <View style={{ flex: 1 }}>
              <Text style={styles.rutaName}>{item.nombre}</Text>
              <Text style={styles.rutaDate}>Asignación: {item.fecha ? new Date(item.fecha).toLocaleDateString() : 'Pendiente'}</Text>
           </View>
           <Ionicons name="chevron-forward" size={20} color="#00A9BC" />
        </View>

        <View style={styles.cardFooter}>
           <View style={styles.statBox}>
              <Text style={styles.statValue}>{item.clientes.length}</Text>
              <Text style={styles.statLabel}>Clientes</Text>
           </View>
           <View style={styles.statDivider} />
           <View style={styles.statBox}>
              <Text style={styles.statValue}>{item.visitados}</Text>
              <Text style={styles.statLabel}>Visitados</Text>
           </View>
           <View style={styles.statDivider} />
           <View style={styles.progressBox}>
              <View style={[styles.progressCircle, { borderColor: isCompleted ? '#10b981' : '#00A9BC' }]}>
                 <Text style={[styles.progressText, { color: isCompleted ? '#10b981' : '#00A9BC' }]}>{progress}%</Text>
              </View>
           </View>
        </View>
      </TouchableOpacity>
    );
  };

  const [pendingOfflineIds, setPendingOfflineIds] = useState([]);
  const [pendingStatuses, setPendingStatuses] = useState({});

  useFocusEffect(
    useCallback(() => {
      const loadOfflineStatuses = async () => {
        try {
          const { getPendingClientIds } = require('../services/OfflineService');
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const pending = await getPendingClientIds();
          setPendingOfflineIds(pending);
          
          const rawQueue = await AsyncStorage.getItem('rz_pending_fichas');
          const queue = rawQueue ? JSON.parse(rawQueue) : [];
          const pendingMap = {};
          queue.forEach(item => {
            pendingMap[String(item.clienteId)] = item.formData.tipificacion === 'PAGO' ? 'VISITADO_PAGO' : 
                                                item.formData.tipificacion === 'REPROGRAMARA' ? 'REPROGRAMADO' : 'NO_ENCONTRADO';
          });
          setPendingStatuses(pendingMap);
        } catch (err) {
          console.log('[RutaScreen] Error loading pending queue status:', err);
        }
      };
      loadOfflineStatuses();
    }, [])
  );

  const renderFlatClientCard = ({ item, index }) => {
    const isOfflinePending = pendingOfflineIds.includes(String(item.cliente_id));
    const cliente_estado = isOfflinePending ? (pendingStatuses[String(item.cliente_id)] || item.cliente_estado) : item.cliente_estado;
    
    const getStatusColor = (estado) => {
      switch (estado) {
        case 'EN_VISITA':     return '#a855f7';
        case 'VISITADO_PAGO': return '#10b981';
        case 'REPROGRAMADO':  return '#f59e0b';
        case 'NO_ENCONTRADO': return '#ef4444';
        default:              return '#047CFD';
      }
    };
    
    const cardColor = getStatusColor(cliente_estado);
    const isFirst = index === 0;
    const isLast = index === flatClients.length - 1;
    const isGestionado = ['VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO'].includes(cliente_estado);

    return (
      <View style={[styles.clientCard, { borderLeftColor: cardColor, opacity: isGestionado ? 0.7 : 1 }]}>
        <TouchableOpacity
          style={styles.clientCardMain}
          onPress={() => {
            if (isGestionado) {
              Alert.alert('Cliente ya gestionado', 'Este cliente ya cuenta con una visita registrada hoy.');
              return;
            }
            navigation.navigate('DetalleCliente', {
              cliente: {
                ...item,
                id: item.cliente_id || item.id,
                estado: cliente_estado,
                direccion: item.cliente_direccion || item.direccion
              },
              modo: 'RUTA'
            });
          }}
          activeOpacity={isGestionado ? 1 : 0.75}
        >
          <View style={styles.clientTextContainer}>
            <Text style={styles.clientNameText} numberOfLines={1}>
              {item.nombres} {item.apellidos}
            </Text>
            <Text style={styles.clientAddressText} numberOfLines={2}>
              {item.cliente_direccion || item.direccion || 'Sin dirección'}
            </Text>
            
            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: cardColor + '15' }]}>
                <Text style={[styles.statusBadgeText, { color: cardColor }]}>
                  {cliente_estado === 'EN_VISITA' ? 'EN CAMINO' : (cliente_estado || 'LIBRE')}
                </Text>
              </View>
              {isOfflinePending && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline" size={11} color="#FFF" />
                  <Text style={styles.offlineBadgeText}>PENDIENTE</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Reordering Controls */}
        <View style={styles.reorderContainer}>
          <TouchableOpacity
            style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
            disabled={isFirst}
            onPress={() => handleMoveItem(index, 'up')}
          >
            <Ionicons name="chevron-up" size={20} color={isFirst ? '#CBD5E1' : '#047CFD'} />
          </TouchableOpacity>
          <Text style={styles.orderNumber}>{index + 1}</Text>
          <TouchableOpacity
            style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
            disabled={isLast}
            onPress={() => handleMoveItem(index, 'down')}
          >
            <Ionicons name="chevron-down" size={20} color={isLast ? '#CBD5E1' : '#047CFD'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
         <Text style={styles.headerTitle}>Mis Rutas</Text>
         <TouchableOpacity onPress={() => { setLoading(true); fetchData(); }}>
            <Ionicons name="refresh" size={24} color="#00A9BC" />
         </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00A9BC" style={{ marginTop: 50 }} />
      ) : !jornadaEstado || finalizado || enRefrigerio ? (
        <View style={styles.lockBanner}>
          <Ionicons 
            name={enRefrigerio ? "restaurant" : "lock-closed"} 
            size={50} 
            color={enRefrigerio ? "#f59e0b" : "#94a3b8"} 
          />
          <Text style={styles.lockTitle}>{enRefrigerio ? "En hora de almuerzo" : "Jornada no iniciada"}</Text>
          <Text style={styles.lockSub}>
            {enRefrigerio 
              ? "Tu jornada está pausada. Vuelve a Clientes para finalizar tu almuerzo."
              : "Ve a Clientes e INICIA DÍA para ver tus rutas."}
          </Text>
          {!enRefrigerio && (
            <TouchableOpacity 
              style={styles.lockBtn} 
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.lockBtnText}>IR A CLIENTES</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={MODELO_NEGOCIO === 'CAJA_HUANCAYO' ? flatClients : groupedRutas}
          renderItem={MODELO_NEGOCIO === 'CAJA_HUANCAYO' ? renderFlatClientCard : renderRutaCard}
          keyExtractor={(item, index) => MODELO_NEGOCIO === 'CAJA_HUANCAYO' ? `client-${item.id || item.cliente_id}-${index}` : `ruta-${item.id}-${index}`}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
               <Ionicons name="map-outline" size={80} color="#94a3b8" />
               <Text style={styles.emptyText}>
                 {MODELO_NEGOCIO === 'CAJA_HUANCAYO'
                   ? "No has seleccionado clientes para tu ruta."
                   : "No tienes rutas asignadas para hoy."}
               </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E5E5E0',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', letterSpacing: 0.5 },
  list: { padding: 20, paddingBottom: 100 },
  rutaCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    marginBottom: 20, 
    borderWidth: 1,
    borderColor: '#E5E5E0',
    padding: 20 
  },
  rutaCardCompleted: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconContainer: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(66, 99, 235, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rutaName: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  rutaDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F0', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E5E5E0' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '850', color: '#1A1A1A' },
  statLabel: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', marginTop: 2, fontWeight: 'bold' },
  statDivider: { width: 1, height: 20, backgroundColor: '#E5E5E0' },
  progressBox: { flex: 1, alignItems: 'center' },
  progressCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  progressText: { fontSize: 10, fontWeight: 'bold' },
  emptyBox: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#6B7280', marginTop: 15, fontSize: 16, fontWeight: '600' },
  // Lock banner styles
  lockBanner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  lockTitle: { fontSize: 20, fontWeight: '950', color: '#1A1A1A' },
  lockSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  lockBtn: { backgroundColor: '#4263EB', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, marginTop: 16 },
  lockBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  // Estilos para la lista plana de Caja Huancayo
  clientCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E0',
    borderLeftWidth: 6,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  clientCardMain: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  clientTextContainer: {
    flex: 1,
  },
  clientNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  clientAddressText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  offlineBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  reorderContainer: {
    width: 55,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E5E0',
    backgroundColor: '#F9F9FB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  reorderBtn: {
    padding: 6,
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1A1A1A',
    marginVertical: 4,
  },
});

export default RutaScreen;
