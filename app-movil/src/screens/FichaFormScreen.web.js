import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const FichaFormScreen = ({ route, navigation }) => {
  const { cliente } = route.params;
  const { api } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    monto_cuota: '',
    observacion: '',
    tipificacion: 'PAGO'
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.post(`/api/workers/clientes/${cliente.id}/ficha`, {
        ...formData,
        evidencias: [] 
      });
      Alert.alert('Éxito', 'Gestión guardada (Modo Web)');
      navigation.navigate('Ruta');
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la ficha.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View>
      <Text style={styles.title}>Validar Datos (Web)</Text>
      <View style={styles.card}>
        <Text style={styles.val}>{cliente.nombres} {cliente.apellidos}</Text>
        <Text style={styles.sub}>DNI: {cliente.dni}</Text>
      </View>
      <TouchableOpacity style={styles.btn} onPress={() => setStep(2)}>
        <Text style={styles.btnText}>Siguiente</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.dots}>
        {[1, 2].map(i => <View key={i} style={[styles.dot, step === i && styles.activeDot]} />)}
      </View>
      {step === 1 ? renderStep1() : (
        <View>
          <Text style={styles.title}>Formulario (Web)</Text>
          <TextInput 
            placeholder="Monto de cuota" 
            style={styles.input} 
            keyboardType="numeric"
            onChangeText={(v) => setFormData({...formData, monto_cuota: v})}
          />
          <TextInput 
            placeholder="Observaciones" 
            style={[styles.input, { height: 100 }]} 
            multiline
            onChangeText={(v) => setFormData({...formData, observacion: v})}
          />
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#10B981' }]} onPress={handleSave}>
            <Text style={styles.btnText}>GUARDAR</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 25 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  activeDot: { backgroundColor: '#3B82F6', width: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  card: { padding: 20, backgroundColor: '#F9FAFB', borderRadius: 15 },
  val: { fontSize: 18, fontWeight: '700' },
  sub: { color: '#6B7280', marginTop: 5 },
  input: { backgroundColor: '#F3F4F6', padding: 15, borderRadius: 12, marginBottom: 15 },
  btn: { backgroundColor: '#3B82F6', padding: 20, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#FFF', fontWeight: '700' }
});

export default FichaFormScreen;
