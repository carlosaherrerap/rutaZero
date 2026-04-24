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
    default:              return { color: '#3b82f6', label: 'LIBRE',          icon: 'ellipse-outline' };
  }
};

const RutaDetalleScreen = ({ route, navigation }) => {
  const { ruta: rutaParams } = route.params;
  const { api } = useContext(AuthContext);

  const [clientes, setClientes] = useState(rutaParams.clientes || []);
  const [rutaNombre, setRutaNombre] = useState(rutaParams.nombre);
  const [loading, setLoading] = useState(false);

  // ✅ REFRESH cada vez que el screen gana foco (volver de FichaForm o DetalleCliente)
  useFocusEffect(
    useCallback(() => {
      const fetchFreshClientes = async () => {
        setLoading(true);
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
          console.log('[RutaDetalle] Error refreshing:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchFreshClientes();
    }, [api, rutaParams.id])
  );

  // Estadísticas en tiempo real
  const totalClientes  = clientes.length;
  const visitados      = clientes.filter(c => ESTADOS_GESTIONADOS.includes(c.cliente_estado)).length;
  const enCamino       = clientes.filter(c => c.cliente_estado === 'EN_VISITA').length;
  const libres         = clientes.filter(c => c.cliente_estado === 'LIBRE' || !c.cliente_estado).length;
  const progreso       = totalClientes > 0 ? Math.round((visitados / totalClientes) * 100) : 0;

  const renderCliente = ({ item }) => {
    const status = getStatusInfo(item.cliente_estado);
    const isGestionado = ESTADOS_GESTIONADOS.includes(item.cliente_estado);

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
              estado: item.cliente_estado,
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
            <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
              <Ionicons name={status.icon} size={11} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}> {status.label}</Text>
            </View>
          </View>

          <Text style={styles.clientAddress} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} /> {item.cliente_direccion}
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
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
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
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{rutaNombre}</Text>
          <Text style={styles.headerSub}>{totalClientes} clientes asignados</Text>
        </View>
        {loading && <ActivityIndicator size="small" color="#3b82f6" />}
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
          <Text style={[styles.statNum, { color: '#3b82f6' }]}>{libres}</Text>
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
            <Ionicons name="people-outline" size={60} color="#cbd5e1" />
            <Text style={styles.emptyText}>No hay clientes en esta ruta.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },

  // Progreso
  progressContainer: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  progressBg: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  progressLabel: { fontSize: 11, color: '#64748b', fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 10, marginBottom: 8, elevation: 1 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  statLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },

  // Lista
  list: { padding: 12, paddingBottom: 30 },
  clientCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderLeftWidth: 5, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, overflow: 'hidden' },
  clientCardDone: { opacity: 0.75 },
  doneOverlay: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 0 },
  doneText: { fontSize: 11, fontWeight: '800' },
  clientMain: { padding: 14 },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  clientName: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  clientNameDone: { color: '#64748b' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800' },
  clientAddress: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  clientFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  infoTag: { flex: 1 },
  infoLabel: { fontSize: 9, color: '#94a3b8', fontWeight: 'bold' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 2 },

  // Empty
  emptyBox: { marginTop: 80, alignItems: 'center' },
  emptyText: { color: '#94a3b8', marginTop: 12, fontSize: 15, fontWeight: '600' },
});

export default RutaDetalleScreen;
