import React, { useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// Estados que indican que el cliente YA FUE GESTIONADO (nadie más puede visitarlo)
const ESTADOS_GESTIONADOS = ['VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO'];

const getStatusInfo = (estado) => {
  switch (estado) {
    case 'EN_VISITA':     return { color: '#a855f7', label: 'EN CAMINO',     icon: 'navigate' };
    case 'VISITADO_PAGO': return { color: '#10b981', label: 'GESTIONADO',    icon: 'checkmark-circle' };
    case 'REPROGRAMADO':  return { color: '#f59e0b', label: 'REPROGRAMADO',  icon: 'calendar' };
    case 'NO_ENCONTRADO': return { color: '#ef4444', label: 'NO ENCONTRADO', icon: 'close-circle' };
    default:              return { color: '#00A9BC', label: 'LIBRE',          icon: 'ellipse-outline' };
  }
};

const RutaDetalleScreen = ({ route, navigation }) => {
  const { ruta: rutaParams } = route.params;
  const { api } = useContext(AuthContext);

  const [clientes, setClientes] = useState(rutaParams.clientes || []);
  const [rutaNombre, setRutaNombre] = useState(rutaParams.nombre);
  const [loading, setLoading] = useState(false);

  const [pendingOfflineIds, setPendingOfflineIds] = useState([]);
  const [pendingStatuses, setPendingStatuses] = useState({});

  // ✅ REFRESH cada vez que el screen gana foco (volver de FichaForm o DetalleCliente)
  useFocusEffect(
    useCallback(() => {
      const fetchFreshClientes = async () => {
        setLoading(true);
        // Cargar pendientes offline
        let pending = [];
        let pendingMap = {};
        try {
          const { getPendingClientIds } = require('../services/OfflineService');
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          pending = await getPendingClientIds();
          setPendingOfflineIds(pending);
          
          const rawQueue = await AsyncStorage.getItem('rz_pending_fichas');
          const queue = rawQueue ? JSON.parse(rawQueue) : [];
          queue.forEach(item => {
            pendingMap[String(item.clienteId)] = item.formData.tipificacion === 'PAGO' ? 'VISITADO_PAGO' : 
                                                item.formData.tipificacion === 'REPROGRAMARA' ? 'REPROGRAMADO' : 'NO_ENCONTRADO';
          });
          setPendingStatuses(pendingMap);
        } catch (err) {
          console.log('[RutaDetalle] Error loading pending queue status:', err);
        }

        try {
          const res = await api.get('/api/workers/me/ruta');
          const rawData = res.data.data || [];
          // Filtrar solo los clientes de esta ruta
          const clientesDeLaRuta = rawData.filter(item => item.ruta_id === rutaParams.id && item.cliente_id);
          if (clientesDeLaRuta.length > 0) {
            setClientes(clientesDeLaRuta);
            setRutaNombre(clientesDeLaRuta[0].ruta_nombre || rutaParams.nombre);
          }
        } catch (e) {
          console.log('[RutaDetalle] Error refreshing online, loading offline fallback:', e.message);
          try {
            const { getDayData } = require('../services/OfflineService');
            const localData = await getDayData();
            if (localData && localData.rutas) {
              const clientesDeLaRuta = localData.rutas.filter(
                item => String(item.ruta_id) === String(rutaParams.id) && item.cliente_id
              );
              if (clientesDeLaRuta.length > 0) {
                setClientes(clientesDeLaRuta);
                setRutaNombre(clientesDeLaRuta[0].ruta_nombre || rutaParams.nombre);
              }
            }
          } catch (offlineErr) {
            console.log('[RutaDetalle] Local fallback error:', offlineErr);
          }
        } finally {
          setLoading(false);
        }
      };
      fetchFreshClientes();
    }, [api, rutaParams.id])
  );

  // Obtener estado real (con override de cola offline)
  const getRealEstado = (c) => {
    const isOfflinePending = pendingOfflineIds.includes(String(c.cliente_id));
    return isOfflinePending ? (pendingStatuses[String(c.cliente_id)] || c.cliente_estado) : c.cliente_estado;
  };

  // Estadísticas en tiempo real
  const totalClientes  = clientes.length;
  const visitados      = clientes.filter(c => ESTADOS_GESTIONADOS.includes(getRealEstado(c))).length;
  const enCamino       = clientes.filter(c => getRealEstado(c) === 'EN_VISITA').length;
  const libres         = clientes.filter(c => getRealEstado(c) === 'LIBRE' || !getRealEstado(c)).length;
  const progreso       = totalClientes > 0 ? Math.round((visitados / totalClientes) * 100) : 0;

  const renderCliente = ({ item }) => {
    const isOfflinePending = pendingOfflineIds.includes(String(item.cliente_id));
    const cliente_estado = isOfflinePending ? (pendingStatuses[String(item.cliente_id)] || item.cliente_estado) : item.cliente_estado;
    const status = getStatusInfo(cliente_estado);
    const isGestionado = ESTADOS_GESTIONADOS.includes(cliente_estado);

    return (
      <TouchableOpacity
        style={[
          styles.clientCard,
          { borderLeftColor: status.color },
          isGestionado && styles.clientCardDone
        ]}
        onPress={() => {
          if (isGestionado) return; // BLOQUEADO: ya fue gestionado
          navigation.navigate('DetalleCliente', {
            cliente: {
              ...item,
              id: item.cliente_id,
              estado: cliente_estado,
              direccion: item.cliente_direccion
            }
          });
        }}
        activeOpacity={isGestionado ? 1 : 0.75}
      >
        {/* Overlay de "completado" */}
        {isGestionado && (
          <View style={styles.doneOverlay}>
            <Ionicons name={status.icon} size={20} color={status.color} />
            <Text style={[styles.doneText, { color: status.color }]}>{status.label}</Text>
          </View>
        )}

        <View style={styles.clientMain}>
          <View style={styles.clientHeader}>
            <Text style={[styles.clientName, isGestionado && styles.clientNameDone]} numberOfLines={1}>
              {item.nombres} {item.apellidos}
            </Text>
            {isOfflinePending && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ef4444',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                marginRight: 6
              }}>
                <Ionicons name="cloud-offline" size={9} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold', marginLeft: 3 }}>PENDIENTE</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
              <Ionicons name={status.icon} size={11} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}> {status.label}</Text>
            </View>
          </View>

          <Text style={styles.clientAddress} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} color="#00A9BC" /> {item.cliente_direccion}
          </Text>

          <View style={styles.clientFooter}>
            <View style={styles.infoTag}>
              <Text style={styles.infoLabel}>DEUDA</Text>
              <Text style={styles.infoValue}>S/ {parseFloat(item.deuda_total || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.infoTag}>
              <Text style={styles.infoLabel}>DISTRITO</Text>
              <Text style={styles.infoValue}>{item.distrito}</Text>
            </View>
            {!isGestionado && (
              <Ionicons name="chevron-forward" size={18} color="#00A9BC" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#00A9BC" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{rutaNombre}</Text>
          <Text style={styles.headerSub}>{totalClientes} clientes asignados</Text>
        </View>
        {loading && <ActivityIndicator size="small" color="#00A9BC" />}
      </View>

      {/* BARRA DE PROGRESO */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progreso}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{progreso}% completado</Text>
      </View>

      {/* STATS */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalClientes}</Text>
          <Text style={styles.statLabel}>TOTAL</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#10b981' }]}>{visitados}</Text>
          <Text style={styles.statLabel}>GESTIONADOS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#a855f7' }]}>{enCamino}</Text>
          <Text style={styles.statLabel}>EN CAMINO</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#00A9BC' }]}>{libres}</Text>
          <Text style={styles.statLabel}>PENDIENTES</Text>
        </View>
      </View>

      {/* LISTA */}
      <FlatList
        data={clientes}
        renderItem={renderCliente}
        keyExtractor={item => item.cliente_id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={60} color="#94a3b8" />
            <Text style={styles.emptyText}>No hay clientes en esta ruta.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 },
  headerSub: { fontSize: 12, color: '#00A9BC', fontWeight: '600', marginTop: 1 },

  // Progreso
  progressContainer: { paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  progressBg: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  progressLabel: { fontSize: 11, color: '#64748B', fontWeight: '700' },

  // Stats
  statsRow: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    paddingVertical: 14, 
    paddingHorizontal: 10, 
    marginBottom: 12, 
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  statLabel: { fontSize: 9, color: '#64748B', fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },

  // Lista
  list: { padding: 12, paddingBottom: 30 },
  clientCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    marginBottom: 12, 
    borderLeftWidth: 5, 
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden' 
  },
  clientCardDone: { opacity: 0.7 },
  doneOverlay: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 0 },
  doneText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  clientMain: { padding: 14 },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clientName: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 8 },
  clientNameDone: { color: '#64748B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800' },
  clientAddress: { fontSize: 12, color: '#64748B', marginBottom: 12 },
  clientFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
  infoTag: { flex: 1 },
  infoLabel: { fontSize: 9, color: '#64748B', fontWeight: 'bold', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginTop: 2 },

  // Empty
  emptyBox: { marginTop: 80, alignItems: 'center' },
  emptyText: { color: '#64748B', marginTop: 12, fontSize: 15, fontWeight: '600' },
});

export default RutaDetalleScreen;
