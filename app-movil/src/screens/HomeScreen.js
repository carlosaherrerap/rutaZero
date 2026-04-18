import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
  const { user, logout, api } = useContext(AuthContext);
  const [journeyStatus, setJourneyStatus] = useState('INACTIVO');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get(`/api/workers/${user.id}`);
      setJourneyStatus(res.data.data.estado_jornada || 'INACTIVO');
    } catch (e) {
      console.log('Error fetching status');
    }
  };

  const handleStartJourney = async () => {
    setLoading(true);
    try {
      await api.post('/api/workers/jornada/iniciar');
      setJourneyStatus('JORNADA_INICIADA');
      Alert.alert('¡Éxito!', 'Jornada iniciada correctamente');
    } catch (e) {
      Alert.alert('Error', 'No se pudo iniciar jornada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Bienvenido,</Text>
            <Text style={styles.name}>{user?.nombres} 👋</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado de Jornada</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{journeyStatus}</Text>
          </View>
          
          <TouchableOpacity style={styles.mainBtn} onPress={journeyStatus === 'INACTIVO' ? handleStartJourney : () => navigation.navigate('Ruta')}>
            <Text style={styles.mainBtnText}>
                {journeyStatus === 'INACTIVO' ? '🚀 Iniciar Jornada' : '📍 Ver Mi Ruta'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 60 },
  content: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  welcome: { color: '#7d8590', fontSize: 16 },
  name: { color: '#e6edf3', fontSize: 24 },
  logoutBtn: { padding: 8, backgroundColor: '#21262d', borderRadius: 8 },
  logoutText: { color: '#ef4444' },
  card: { backgroundColor: '#161b22', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#30363d' },
  cardTitle: { color: '#7d8590', fontSize: 13, textTransform: 'uppercase', marginBottom: 12 },
  statusBadge: { backgroundColor: '#21262d', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 20, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, color: '#e6edf3' },
  mainBtn: { backgroundColor: '#2563eb', padding: 18, borderRadius: 12, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 16 },
});
