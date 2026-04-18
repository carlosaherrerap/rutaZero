import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function FichaScreen({ route, navigation }) {
  const { client } = route.params;
  const { api } = useContext(AuthContext);
  const [tipificacion, setTipificacion] = useState('');
  const [monto, setMonto] = useState('');
  const [observacion, setObservacion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!tipificacion) return Alert.alert('Error', 'Selecciona una tipificación');
    setLoading(true);
    try {
      await api.post(`/api/workers/clientes/${client.id}/ficha`, {
        tipificacion,
        monto_cuota: monto,
        observacion
      });
      Alert.alert('¡Excelente!', 'Gestión guardada con éxito.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Error al guardar la gestión');
    } finally {
      setLoading(false);
    }
  };

  const getTipBtnStyle = (type) => [
    styles.tipBtn,
    tipificacion === type ? styles.tipBtnActive : null
  ];

  return (
    <View style={[styles.container, { paddingTop: 50 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.clientBar}>
          <Text style={styles.clientName}>{client.nombres} {client.apellidos}</Text>
          <Text style={styles.clientDeuda}>Deuda: S/ {client.deuda_total}</Text>
        </View>

        <Text style={styles.label}>Tipificación de Gestión</Text>
        <View style={styles.tipGrid}>
          <TouchableOpacity style={getTipBtnStyle('PAGO')} onPress={() => setTipificacion('PAGO')}>
            <Text style={styles.tipEmoji}>💵</Text>
            <Text style={styles.tipLabel}>Pago Total</Text>
          </TouchableOpacity>
          <TouchableOpacity style={getTipBtnStyle('REPROGRAMARA')} onPress={() => setTipificacion('REPROGRAMARA')}>
            <Text style={styles.tipEmoji}>🕒</Text>
            <Text style={styles.tipLabel}>Reprogramado</Text>
          </TouchableOpacity>
          <TouchableOpacity style={getTipBtnStyle('NO_ENCONTRADO')} onPress={() => setTipificacion('NO_ENCONTRADO')}>
            <Text style={styles.tipEmoji}>🚫</Text>
            <Text style={styles.tipLabel}>No Encontrado</Text>
          </TouchableOpacity>
        </View>

        {tipificacion === 'PAGO' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Monto Recibido (S/)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#484f58"
              keyboardType="numeric"
              value={monto}
              onChangeText={setMonto}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Observaciones</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Escribe detalles de la visita..."
            placeholderTextColor="#484f58"
            multiline={true}
            numberOfLines={4}
            value={observacion}
            onChangeText={setObservacion}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar Gestión</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 20 },
  clientBar: { backgroundColor: '#161b22', padding: 20, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: '#30363d' },
  clientName: { color: '#e6edf3', fontSize: 18, fontWeight: '700' },
  clientDeuda: { color: '#2563eb', fontWeight: '600', marginTop: 4 },
  label: { color: '#7d8590', fontSize: 13, marginBottom: 12, fontWeight: '700', textTransform: 'uppercase' },
  tipGrid: { flexDirection: 'row', marginBottom: 25 },
  tipBtn: { flex: 1, backgroundColor: '#161b22', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#30363d', marginHorizontal: 4 },
  tipBtnActive: { borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)' },
  tipEmoji: { fontSize: 24, marginBottom: 6 },
  tipLabel: { color: '#e6edf3', fontSize: 10, textAlign: 'center', fontWeight: '600' },
  inputGroup: { marginBottom: 20 },
  input: { backgroundColor: '#161b22', borderWidth: 1, borderColor: '#30363d', color: '#e6edf3', borderRadius: 8, padding: 12, fontSize: 16 },
  textarea: { height: 100 },
  saveBtn: { backgroundColor: '#2563eb', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
