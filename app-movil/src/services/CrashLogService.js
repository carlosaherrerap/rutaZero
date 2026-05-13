import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CRASH_LOG_KEY = 'rz_crash_logs';
const MAX_LOGS = 50;

/**
 * Guarda un error en el historial de crash logs de AsyncStorage.
 * @param {Error} error - El objeto de error capturado.
 * @param {string} context - Contexto adicional (ej: nombre del screen).
 */
export async function saveCrashLog(error, context = 'UNKNOWN') {
  try {
    const existing = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const logs = existing ? JSON.parse(existing) : [];

    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      context,
      message: error?.message || String(error),
      stack: error?.stack?.substring(0, 800) || 'No stack trace', // Limitamos para no llenar storage
    };

    // Añadir al inicio y limitar el máximo de logs
    logs.unshift(newLog);
    if (logs.length > MAX_LOGS) logs.splice(MAX_LOGS);

    await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(logs));
    console.error(`🔴 [CrashLog] Guardado: [${context}] ${newLog.message}`);
  } catch (e) {
    // Si falla el propio sistema de logs, no hacemos nada para no causar otro crash
    console.error('❌ [CrashLogService] Error al guardar crash log:', e);
  }
}

/**
 * Obtiene todos los crash logs guardados.
 * @returns {Promise<Array>}
 */
export async function getCrashLogs() {
  try {
    const data = await AsyncStorage.getItem(CRASH_LOG_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Limpia todos los crash logs.
 */
export async function clearCrashLogs() {
  await AsyncStorage.removeItem(CRASH_LOG_KEY);
}

/**
 * ErrorBoundary: Componente de clase que captura crashes de React
 * y muestra una pantalla de error segura en lugar de cerrar la app.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Guardar en caché automáticamente
    saveCrashLog(error, this.props.context || 'ErrorBoundary');
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Ionicons name="warning" size={60} color="#ef4444" />
          <Text style={errStyles.title}>Ocurrió un Error</Text>
          <Text style={errStyles.subtitle}>
            El error fue guardado automáticamente.{'\n'}
            Puedes verlo en el 🐛 Inspector de Datos.
          </Text>
          <ScrollView style={errStyles.msgBox}>
            <Text style={errStyles.msgText}>{this.state.error?.message}</Text>
          </ScrollView>
          {this.props.onBack && (
            <TouchableOpacity style={errStyles.btn} onPress={() => {
              this.setState({ hasError: false, error: null });
              this.props.onBack();
            }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={errStyles.btnText}>VOLVER</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { color: '#ef4444', fontSize: 22, fontWeight: '900', marginTop: 15 },
  subtitle: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  msgBox: { maxHeight: 120, backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginTop: 20, width: '100%' },
  msgText: { color: '#f87171', fontSize: 11, fontFamily: 'monospace' },
  btn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', padding: 15, borderRadius: 12, marginTop: 25, gap: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
