import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, TextInput, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';

const PermisosScreen = () => {
  const { api } = useContext(AuthContext);
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ tipo: 'Medico', fecha_inicio: '', fecha_fin: '', descripcion: '' });

  const fetchPermisos = async () => {
    try {
      const res = await api.get('/api/trabajadores/mis-permisos');
      setPermisos(res.data.data);
    } catch (e) {
      console.log('Error fetching permisos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPermisos(); }, []);

  const handleRequest = async () => {
    if (!form.fecha_inicio || !form.descripcion) {
      return Alert.alert('Error', 'Completa los campos obligatorios');
    }
    try {
      await api.post('/api/trabajadores/solicitar-permiso', form);
      Alert.alert('Éxito', 'Solicitud enviada correctamente');
      setModalVisible(false);
      fetchPermisos();
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar la solicitud');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APROBADO': return '#10b981';
      case 'RECHAZADO': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Permisos</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={permisos}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardType}>{item.tipo}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(item.estado) }]}>
                  <Text style={styles.badgeText}>{item.estado}</Text>
                </View>
              </View>
              <Text style={styles.cardDates}>
                {format(new Date(item.fecha_inicio), 'dd MMM', { locale: es })} - {format(new Date(item.fecha_fin), 'dd MMM', { locale: es })}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.descripcion}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>No tienes solicitudes de permiso</Text>
            </View>
          }
        />
      )}

      {/* Modal de Solicitud */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva Solicitud</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Tipo (Ej: Medico, Personal)" 
              onChangeText={t => setForm({...form, tipo: t})}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput 
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="Inicio (YYYY-MM-DD)" 
                  onChangeText={t => setForm({...form, fecha_inicio: t})}
                />
                <TextInput 
                  style={[styles.input, { flex: 1 }]} 
                  placeholder="Fin (YYYY-MM-DD)" 
                  onChangeText={t => setForm({...form, fecha_fin: t})}
                />
            </View>
            <TextInput 
              style={[styles.input, { height: 80 }]} 
              placeholder="Motivo detallado..." 
              multiline
              onChangeText={t => setForm({...form, descripcion: t})}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRequest} style={styles.submitBtn}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Solicitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  addBtn: { backgroundColor: '#3b82f6', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  list: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardType: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardDates: { fontSize: 14, color: '#64748b', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#94a3b8' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, color: '#94a3b8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 15, marginBottom: 12 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 10 },
  cancelBtn: { padding: 15 },
  submitBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 25, borderRadius: 12, justifyContent: 'center' }
});

export default PermisosScreen;
