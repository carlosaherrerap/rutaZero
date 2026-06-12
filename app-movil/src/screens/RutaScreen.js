import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

const RutaScreen = ({ navigation }) => {
  const { api, user } = useContext(AuthContext);
  const [groupedRutas, setGroupedRutas] = useState([]);
  const [jornadaEstado, setJornadaEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const { getDayData, logConnectionStatus } = require('../services/OfflineService');
    const { addEventListener } = require('@react-native-community/netinfo');
    
    // Check connection
    const net = await require('@react-native-community/netinfo').fetch();
    const isOnline = net.isConnected;

    try {
      if (!isOnline) {
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
          data={groupedRutas}
          renderItem={renderRutaCard}
          keyExtractor={(item, index) => `ruta-${item.id}-${index}`}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
               <Ionicons name="map-outline" size={80} color="#94a3b8" />
               <Text style={styles.emptyText}>No tienes rutas asignadas para hoy.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', letterSpacing: 0.5 },
  list: { padding: 20, paddingBottom: 100 },
  rutaCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    marginBottom: 20, 
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20 
  },
  rutaCardCompleted: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconContainer: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(0, 169, 188, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rutaName: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  rutaDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '850', color: '#1E293B' },
  statLabel: { fontSize: 10, color: '#64748B', textTransform: 'uppercase', marginTop: 2, fontWeight: 'bold' },
  statDivider: { width: 1, height: 20, backgroundColor: '#E2E8F0' },
  progressBox: { flex: 1, alignItems: 'center' },
  progressCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  progressText: { fontSize: 10, fontWeight: 'bold' },
  emptyBox: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#64748B', marginTop: 15, fontSize: 16, fontWeight: '600' },
  // Lock banner styles
  lockBanner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  lockTitle: { fontSize: 20, fontWeight: '950', color: '#1E293B' },
  lockSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  lockBtn: { backgroundColor: '#00A9BC', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, marginTop: 16 },
  lockBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

export default RutaScreen;
