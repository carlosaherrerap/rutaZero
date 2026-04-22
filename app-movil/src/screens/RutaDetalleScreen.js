import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const RutaDetalleScreen = ({ route, navigation }) => {
  const { ruta } = route.params;

  const getStatusInfo = (estado) => {
    switch (estado) {
      case 'EN_VISITA': return { color: '#a855f7', label: 'EN CAMINO' };
      case 'VISITADO_PAGO': return { color: '#10b981', label: 'GESTIONADO' };
      case 'REPROGRAMADO': return { color: '#f59e0b', label: 'REPROGRAMADO' };
      case 'NO_ENCONTRADO': return { color: '#ef4444', label: 'NO ENCONTRADO' };
      default: return { color: '#3b82f6', label: 'LIBRE' };
    }
  };

  const renderCliente = ({ item }) => {
    const status = getStatusInfo(item.cliente_estado);
    const isVisitado = item.cliente_estado !== 'LIBRE' && item.cliente_estado !== 'EN_VISITA';

    return (
      <TouchableOpacity 
        style={[styles.clientCard, { borderLeftColor: status.color }]}
        onPress={() => navigation.navigate('DetalleCliente', { cliente: {
          ...item,
          id: item.cliente_id,
          estado: item.cliente_estado,
          direccion: item.cliente_direccion
        }})}
        disabled={isVisitado && item.cliente_estado === 'VISITADO_PAGO'}
      >
        <View style={styles.clientMain}>
          <View style={styles.clientHeader}>
            <Text style={styles.clientName}>{item.nombres} {item.apellidos}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
               <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
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
             <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
         </TouchableOpacity>
         <View>
            <Text style={styles.headerTitle}>{ruta.nombre}</Text>
            <Text style={styles.headerSub}>{ruta.clientes.length} Clientes en esta ruta</Text>
         </View>
      </View>

      <FlatList
        data={ruta.clientes}
        renderItem={renderCliente}
        keyExtractor={item => item.cliente_id.toString()}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 12, color: '#64748b' },
  list: { padding: 15 },
  clientCard: { backgroundColor: '#fff', borderRadius: 18, marginBottom: 15, borderLeftWidth: 6, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  clientMain: { padding: 15 },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  clientName: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800' },
  clientAddress: { fontSize: 13, color: '#64748b', marginBottom: 15 },
  clientFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  infoTag: { flex: 1 },
  infoLabel: { fontSize: 9, color: '#94a3b8', fontWeight: 'bold' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 2 }
});

export default RutaDetalleScreen;
