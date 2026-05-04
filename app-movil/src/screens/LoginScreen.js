import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!username || !password) return Alert.alert('Aviso', 'Por favor, ingresa tu usuario y contraseña.');
    setLoading(true);
    try {
      await login(username, password);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo conectar al servidor. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b', '#0f172a']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.content}>
          {/* Circulos decorativos de fondo */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          
          <View style={styles.glassCard}>
            <View style={styles.logoContainer}>
              <View style={styles.iconWrapper}>
                <Ionicons name="map-outline" size={45} color="#fff" />
              </View>
              <Text style={styles.logoTitle}>Routing</Text>
              <Text style={styles.logoSub}>WORKER PORTAL</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Usuario"
                  placeholderTextColor="#64748b"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.button} 
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient 
                  colors={['#3b82f6', '#2563eb']} 
                  start={{x:0, y:0}} end={{x:1, y:1}} 
                  style={styles.btnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Olvidaste tu contraseña? Contacta al administrador</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 25, justifyContent: 'center' },
  circle1: { position: 'absolute', top: height * 0.1, left: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: '#3b82f6', opacity: 0.15 },
  circle2: { position: 'absolute', bottom: height * 0.15, right: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: '#a855f7', opacity: 0.15 },
  glassCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoContainer: { alignItems: 'center', marginBottom: 35 },
  iconWrapper: {
    width: 80, height: 80,
    borderRadius: 25,
    backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  logoTitle: { color: '#f8fafc', fontSize: 32, fontWeight: '900', letterSpacing: 0.5 },
  logoSub: { color: '#94a3b8', fontSize: 13, fontWeight: '700', letterSpacing: 3, marginTop: 4 },
  form: { marginTop: 10 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 16,
    height: '100%',
  },
  eyeBtn: { padding: 10 },
  button: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  btnGradient: {
    flexDirection: 'row',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  footer: { marginTop: 30, alignItems: 'center' },
  footerText: { color: '#64748b', fontSize: 12, textAlign: 'center' }
});
