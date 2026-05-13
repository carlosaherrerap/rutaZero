import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCrashLogs, clearCrashLogs } from '../services/CrashLogService';

export default function DebugStorageScreen({ navigation }) {
  const [data, setData]           = useState(null);
  const [crashLogs, setCrashLogs] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('cache'); // 'cache' | 'crashes'

  const loadAll = async () => {
    setLoading(true);
    try {
      const keys   = await AsyncStorage.getAllKeys();
      const result = await AsyncStorage.multiGet(keys);
      const storage = {};
      result.forEach(([key, value]) => {
        try { storage[key] = JSON.parse(value); } catch { storage[key] = value; }
      });
      setData(storage);
      const logs = await getCrashLogs();
      setCrashLogs(logs);
    } catch (e) {
      Alert.alert('Error', 'No se pudo leer el almacenamiento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const clearAll = () => {
    Alert.alert('⚠️ CUIDADO', '¿Borrar TODA la base local?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'SÍ, BORRAR TODO', style: 'destructive', onPress: async () => {
        await AsyncStorage.clear();
        loadAll();
      }}
    ]);
  };

  const handleClearErrors = () => {
    Alert.alert('Limpiar Errores', '¿Borrar el historial de errores?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpiar', style: 'destructive', onPress: async () => {
        await clearCrashLogs();
        setCrashLogs([]);
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

  const renderCrashLog = (log) => (
    <View key={String(log.id)} style={styles.crashCard}>
      <View style={styles.crashHeader}>
        <View style={styles.crashBadge}>
          <Ionicons name="warning" size={12} color="#ef4444" />
          <Text style={styles.crashContext}>{log.context}</Text>
        </View>
        <Text style={styles.crashTime}>
          {new Date(log.timestamp).toLocaleString('es-PE')}
        </Text>
      </View>
      <Text style={styles.crashMessage}>{log.message}</Text>
      <View style={styles.stackBox}>
        <Text style={styles.stackText}>{log.stack}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🐛 Inspector de Datos</Text>
        <TouchableOpacity onPress={loadAll}>
          <Ionicons name="refresh" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'cache' && styles.tabActive]}
          onPress={() => setActiveTab('cache')}
        >
          <Ionicons name="server-outline" size={16} color={activeTab === 'cache' ? '#3b82f6' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'cache' && styles.tabTextActive]}>Caché / Datos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'crashes' && styles.tabActive]}
          onPress={() => setActiveTab('crashes')}
        >
          <Ionicons name="warning-outline" size={16} color={activeTab === 'crashes' ? '#ef4444' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'crashes' && { color: '#ef4444', fontWeight: '800' }]}>
            Errores {crashLogs.length > 0 ? `(${crashLogs.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView style={styles.content}>

          {/* TAB: CACHE */}
          {activeTab === 'cache' && (
            <>
              {data?.rz_day_data && (
                <>
                  {renderSection('👤 TRABAJADOR / JORNADA', data.rz_day_data.journey, 'person')}
                  {renderSection('📋 CLIENTES CACHEADOS', `${data.rz_day_data.clients?.length || 0} clientes`, 'people')}
                  {renderSection('🗺️ RUTAS CACHEADAS', data.rz_day_data.rutas, 'map')}
                </>
              )}
              {renderSection('📦 COLA DE FICHAS (Sync)', data?.rz_pending_fichas || [], 'cloud-upload')}
              {renderSection('⏱️ ACCIONES PENDIENTES', data?.rz_journey_actions || [], 'time')}
              {renderSection('📡 ÚLTIMO LOG CONEXIÓN', data?.rz_sync_log, 'wifi')}

              <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.clearBtnText}>BORRAR TODO EL STORAGE</Text>
              </TouchableOpacity>
            </>
          )}

          {/* TAB: CRASHES */}
          {activeTab === 'crashes' && (
            <>
              {crashLogs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle" size={60} color="#10b981" />
                  <Text style={styles.emptyTitle}>¡Sin errores!</Text>
                  <Text style={styles.emptySubtitle}>La app no ha tenido crashes registrados.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.crashSummary}>
                    <Ionicons name="warning" size={20} color="#ef4444" />
                    <Text style={styles.crashSummaryText}>{crashLogs.length} error(es) registrado(s)</Text>
                  </View>
                  {crashLogs.map(renderCrashLog)}
                  <TouchableOpacity style={[styles.clearBtn, { backgroundColor: '#f97316' }]} onPress={handleClearErrors}>
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.clearBtnText}>LIMPIAR HISTORIAL DE ERRORES</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          <View style={{ height: 50 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#3b82f6' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#3b82f6', fontWeight: '800' },
  content: { padding: 15 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' },
  codeBox: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8 },
  codeText: { color: '#10b981', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: '#10b981', marginTop: 15 },
  emptySubtitle: { color: '#64748b', marginTop: 5, textAlign: 'center' },
  crashSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', padding: 12, borderRadius: 12, marginBottom: 15 },
  crashSummaryText: { color: '#ef4444', fontWeight: '700' },
  crashCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#ef4444', elevation: 2 },
  crashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  crashBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  crashContext: { color: '#ef4444', fontSize: 11, fontWeight: '800' },
  crashTime: { fontSize: 10, color: '#94a3b8' },
  crashMessage: { fontSize: 13, color: '#1e293b', fontWeight: '600', marginBottom: 10 },
  stackBox: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8 },
  stackText: { color: '#f87171', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  clearBtn: { backgroundColor: '#ef4444', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  clearBtnText: { color: '#fff', fontWeight: 'bold' }
});
