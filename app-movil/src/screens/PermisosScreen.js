import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, TextInput, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const PermisosScreen = () => {
  const { api } = useContext(AuthContext);
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  
  const today = new Date();
  const [form, setForm] = useState({ 
    tipo: 'Medico', 
    fecha_inicio: today.toISOString().split('T')[0], 
    fecha_fin: today.toISOString().split('T')[0], 
    descripcion: '' 
  });

  const [showInicio, setShowInicio] = useState(false);
  const [showFin, setShowFin] = useState(false);
  const [dateInicio, setDateInicio] = useState(today);
  const [dateFin, setDateFin] = useState(today);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
    } catch (e) {
      return dateStr;
    }
  };

  const fetchPermisos = async () => {
    try {
      const res = await api.get('/api/workers/me/permisos');
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
      await api.post('/api/workers/me/permisos', form);
      Alert.alert('Éxito', 'Solicitud enviada correctamente');
      setModalVisible(false);
      setForm({ tipo: 'Medico', fecha_inicio: today.toISOString().split('T')[0], fecha_fin: today.toISOString().split('T')[0], descripcion: '' });
      fetchPermisos();
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar la solicitud');
    }
  };

  const onInicioChange = (event, selectedDate) => {
    setShowInicio(false);
    if (selectedDate) {
      setDateInicio(selectedDate);
      setForm({ ...form, fecha_inicio: selectedDate.toISOString().split('T')[0] });
    }
  };

  const onFinChange = (event, selectedDate) => {
    setShowFin(false);
    if (selectedDate) {
      setDateFin(selectedDate);
      setForm({ ...form, fecha_fin: selectedDate.toISOString().split('T')[0] });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'VALIDADO': return '#10b981';
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
          keyExtractor={item => item.id.toString()}
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
                {formatDate(item.fecha_inicio)} {item.fecha_fin !== item.fecha_inicio ? `- ${formatDate(item.fecha_fin)}` : ''}
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

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva Solicitud</Text>
            
            <Text style={styles.label}>Motivo / Tipo</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej: Medico, Personal, Estudios" 
              value={form.tipo}
              onChangeText={t => setForm({...form, tipo: t})}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Desde</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowInicio(true)}>
                    <Text style={styles.dateText}>{form.fecha_inicio}</Text>
                    <Ionicons name="calendar" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Hasta</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowFin(true)}>
                    <Text style={styles.dateText}>{form.fecha_fin}</Text>
                    <Ionicons name="calendar" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
            </View>

            {showInicio && (
              <DateTimePicker
                value={dateInicio}
                mode="date"
                display="default"
                onChange={onInicioChange}
              />
            )}

            {showFin && (
              <DateTimePicker
                value={dateFin}
                mode="date"
                display="default"
                minimumDate={dateInicio}
                onChange={onFinChange}
              />
            )}

            <Text style={styles.label}>Descripción</Text>
            <TextInput 
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
              placeholder="Detalle el motivo de su solicitud..." 
              multiline
              value={form.descripcion}
              onChangeText={t => setForm({...form, descripcion: t})}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={{ color: '#64748b' }}>Cancelar</Text>
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#1e293b' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 15, marginBottom: 15, fontSize: 15, color: '#1e293b' },
  datePickerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9', 
    borderRadius: 12, 
    padding: 15 
  },
  dateText: { fontSize: 15, color: '#1e293b' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { padding: 15 },
  submitBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 25, borderRadius: 12, justifyContent: 'center', height: 50 }
});

export default PermisosScreen;
