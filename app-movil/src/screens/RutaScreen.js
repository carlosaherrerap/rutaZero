import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

const RutaScreen = ({ navigation }) => {
  const { api } = useContext(AuthContext);
  const [groupedRutas, setGroupedRutas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRutas = useCallback(async () => {
    try {
      const res = await api.get('/api/workers/me/ruta');
      const rawData = res.data.data || [];
      
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
    } catch (e) {
      console.log('[Ruta] Error fetching routes', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  // Refrescar cada vez que esta pantalla recibe foco (ej: al volver de FichaForm)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRutas();
    }, [fetchRutas])
  );

  // useEffect original ya no necesario — useFocusEffect lo reemplaza

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
              <Ionicons name="map" size={24} color="#3b82f6" />
           </View>
           <View style={{ flex: 1 }}>
              <Text style={styles.rutaName}>{item.nombre}</Text>
              <Text style={styles.rutaDate}>Asignación: {item.fecha ? new Date(item.fecha).toLocaleDateString() : 'Pendiente'}</Text>
           </View>
           <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
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
              <View style={[styles.progressCircle, isCompleted && { borderColor: '#10b981' }]}>
                 <Text style={[styles.progressText, isCompleted && { color: '#10b981' }]}>{progress}%</Text>
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
         <TouchableOpacity onPress={() => { setLoading(true); fetchRutas(); }}>
            <Ionicons name="refresh" size={24} color="#3b82f6" />
         </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={groupedRutas}
          renderItem={renderRutaCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchRutas(); }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
               <Ionicons name="map-outline" size={80} color="#cbd5e1" />
               <Text style={styles.emptyText}>No tienes rutas asignadas para hoy.</Text>
            </View>
          }
        />
      )}

      {/* BARRA INFERIOR — igual que HomeScreen */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="people" size={24} color="#94a3b8" />
          <Text style={styles.tabLabel}>CLIENTES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="map" size={24} color="#3b82f6" />
          <Text style={[styles.tabLabel, { color: '#3b82f6' }]}>MIS RUTAS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="alert-circle" size={24} color="#94a3b8" />
          <Text style={styles.tabLabel}>NO ENCONTRADOS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  list: { padding: 20, paddingBottom: 100 },
  rutaCard: { backgroundColor: '#fff', borderRadius: 24, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, padding: 20 },
  rutaCardCompleted: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconContainer: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rutaName: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  rutaDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, padding: 15 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, height: 20, backgroundColor: '#e2e8f0' },
  progressBox: { flex: 1, alignItems: 'center' },
  progressCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  progressText: { fontSize: 10, fontWeight: 'bold', color: '#3b82f6' },
  emptyBox: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: '#94a3b8', marginTop: 15, fontSize: 16, fontWeight: '600' },
  // BARRA INFERIOR
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 75, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 20 },
  tabItem: { alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginTop: 4 },
});

export default RutaScreen;
