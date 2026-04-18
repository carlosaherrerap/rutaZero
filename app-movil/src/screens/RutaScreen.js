import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function RutaScreen({ navigation }) {
  const { api } = useContext(AuthContext);
  const [ruta, setRuta] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuta();
  }, []);

  const fetchRuta = async () => {
    try {
      const res = await api.get('/api/workers/me/ruta');
      setRuta(res.data.data || []);
    } catch (e) {
      console.log('Error fetching ruta');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const { Linking } = require('react-native');
    Linking.openURL(url);
  };

  const renderItem = ({ item }) => (
    <View style={styles.clientCard}>
      <TouchableOpacity 
        style={styles.clientInfoContainer}
        onPress={() => navigation.navigate('Ficha', { client: item })}
      >
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{item.orden}</Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.nombres} {item.apellidos}</Text>
          <Text style={styles.clientAddress}>{item.direccion}</Text>
          <Text style={styles.clientDistrito}>{item.distrito}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.clientMeta}>
        <Text style={styles.deudaVal}>S/ {parseFloat(item.deuda_total).toFixed(2)}</Text>
        <TouchableOpacity 
          style={styles.navBtn} 
          onPress={() => handleNavigate(item.latitud, item.longitud)}
        >
          <Text style={styles.navBtnText}>📍 Ir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: 50 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mi Ruta de Hoy</Text>
        <Text style={styles.sub}>{ruta.length} clientes asignados</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={ruta}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No tienes rutas asignadas para hoy.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#30363d' },
  title: { color: '#e6edf3', fontSize: 20, fontWeight: '700' },
  sub: { color: '#7d8590', fontSize: 13, marginTop: 4 },
  list: { padding: 15 },
  clientCard: { 
    backgroundColor: '#161b22', 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden'
  },
  clientInfoContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15 
  },
  orderBadge: { backgroundColor: '#21262d', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  orderText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  clientInfo: { flex: 1 },
  clientName: { color: '#e6edf3', fontWeight: '700', fontSize: 15 },
  clientAddress: { color: '#7d8590', fontSize: 12, marginTop: 2 },
  clientDistrito: { color: '#484f58', fontSize: 11, textTransform: 'uppercase', marginTop: 2 },
  clientMeta: { 
    padding: 12, 
    borderLeftWidth: 1, 
    borderLeftColor: '#30363d', 
    alignItems: 'center', 
    justifyContent: 'center',
    minWidth: 80
  },
  deudaVal: { color: '#e6edf3', fontWeight: '700', fontSize: 13, marginBottom: 8 },
  navBtn: { backgroundColor: '#2563eb', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  navBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  statusPoint: { width: 8, height: 8, borderRadius: 4 },
  bg_libre: { backgroundColor: '#2563eb' },
  bg_visitado_pago: { backgroundColor: '#10b981' },
  bg_reprogramado: { backgroundColor: '#f59e0b' },
  empty: { color: '#7d8590', textAlign: 'center', marginTop: 40 },
});
