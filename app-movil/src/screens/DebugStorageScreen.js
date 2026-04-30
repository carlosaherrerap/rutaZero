import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function DebugStorageScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStorage = async () => {
    setLoading(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const result = await AsyncStorage.multiGet(keys);
      
      const storage = {};
      result.forEach(([key, value]) => {
        try {
          storage[key] = JSON.parse(value);
        } catch {
          storage[key] = value;
        }
      });
      setData(storage);
    } catch (e) {
      Alert.alert('Error', 'No se pudo leer el almacenamiento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  const clearAll = () => {
    Alert.alert('⚠️ CUIDADO', '¿Borrar TODA la base local?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'SÍ, BORRAR TODO', style: 'destructive', onPress: async () => {
        await AsyncStorage.clear();
        loadStorage();
      }}
    ]);
  };

  const renderSection = (title, content, icon) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color="#3b82f6" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>
          {JSON.stringify(content, null, 2)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspector de Datos</Text>
        <TouchableOpacity onPress={loadStorage}>
          <Ionicons name="refresh" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView style={styles.content}>
          {data?.rz_day_data && (
            <>
              {renderSection('👤 TRABAJADOR / JORNADA', data.rz_day_data.journey, 'person')}
              {renderSection('📋 CLIENTES CACHEADOS', data.rz_day_data.clients, 'people')}
              {renderSection('🗺️ RUTAS CACHEADAS', data.rz_day_data.rutas, 'map')}
            </>
          )}
          
          {renderSection('📦 COLA DE FICHAS (Sync)', data?.rz_pending_fichas || [], 'cloud-upload')}
          {renderSection('⏱️ ACCIONES PENDIENTES', data?.rz_journey_actions || [], 'time')}
          {renderSection('📡 ÚLTIMO LOG CONEXIÓN', data?.rz_sync_log, 'wifi')}

          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Text style={styles.clearBtnText}>BORRAR TODO EL STORAGE</Text>
          </TouchableOpacity>
          <View style={{ height: 50 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  content: { padding: 15 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' },
  codeBox: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8 },
  codeText: { color: '#10b981', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  clearBtn: { backgroundColor: '#ef4444', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  clearBtnText: { color: '#fff', fontWeight: 'bold' }
});
