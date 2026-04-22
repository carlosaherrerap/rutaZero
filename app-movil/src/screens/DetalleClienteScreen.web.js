import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const DetalleClienteScreen = ({ route, navigation }) => {
  const { cliente } = route.params;
  const { api } = useContext(AuthContext);
  const [estado, setEstado] = useState(cliente.estado);
  const [loading, setLoading] = useState(false);

  const handleVisitar = async () => {
    setLoading(true);
    try {
      if (estado === 'EN_VISITA') {
        navigation.navigate('FichaForm', { cliente });
      } else {
        await api.post(`/api/workers/clientes/${cliente.id}/visitar`);
        setEstado('EN_VISITA');
        Alert.alert('Éxito', 'Visita iniciada localmente.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo iniciar visita en la web.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapBox}>
        <Ionicons name="map-outline" size={80} color="#9CA3AF" />
        <Text style={styles.webTitle}>Modo Web Activo</Text>
        <Text style={styles.webSub}>El mapa interactivo solo se muestra en el celular físico.</Text>
        <Text style={styles.coords}>Lat: {cliente.latitud} | Lng: {cliente.longitud}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.name}>{cliente.nombres} {cliente.apellidos}</Text>
        <Text style={styles.dir}>{cliente.direccion}</Text>

        <TouchableOpacity 
          style={[styles.btn, estado === 'EN_VISITA' ? styles.btnGreen : styles.btnBlue]} 
          onPress={handleVisitar}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : (
            <Text style={styles.btnText}>
              {estado === 'EN_VISITA' ? '🚀 IR A LLENAR FICHA' : '📍 INICIAR VISITA'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  mapBox: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', padding: 20 },
  webTitle: { fontSize: 20, fontWeight: '800', color: '#1F2937', marginTop: 20 },
  webSub: { color: '#6B7280', textAlign: 'center', marginTop: 10 },
  coords: { color: '#9CA3AF', fontSize: 13, marginTop: 20, fontStyle: 'italic' },
  panel: { padding: 30, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  name: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  dir: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 5, marginBottom: 30 },
  btn: { paddingVertical: 18, borderRadius: 15, alignItems: 'center' },
  btnBlue: { backgroundColor: '#3B82F6' },
  btnGreen: { backgroundColor: '#10B981' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default DetalleClienteScreen;
