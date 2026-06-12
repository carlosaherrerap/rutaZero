import React, { useState, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  ScrollView, Alert, ActivityIndicator, Image, Dimensions, Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { saveCrashLog } from '../services/CrashLogService';
import NetInfo from '@react-native-community/netinfo';

// Fallback seguro para ImagePicker
let ImagePicker = null;
try {
  ImagePicker = require('expo-image-picker');
} catch (e) {
  console.log('ImagePicker not available');
}

const { width } = Dimensions.get('window');

export default function FichaFormScreen({ route, navigation }) {
  const { cliente } = route.params;
  const { api } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Validar, 2: Ficha, 3: Evidencias

  // Form State (Paso 2)
  const [formData, setFormData] = useState({
    tipo_credito: '',
    fecha_desembolso: new Date().toISOString().split('T')[0],
    monto_desembolso: '',
    moneda: 'PEN',
    nro_cuotas: '',
    nro_cuotas_pagadas: '',
    monto_cuota: '',
    condicion_contable: 'RESPONSABLE',
    saldo_capital: '',
    tipificacion: '',
    observacion: ''
  });

  // Timestamps de monitoreo (se calculan automáticamente)
  const horaInicioVisita = React.useRef(new Date().toISOString());
  const horaAperturaFicha = React.useRef(null);

  // Step 3 state
  const [fotos, setFotos] = useState([]);

  const updateField = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert('Aviso', 'Cámara no disponible.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requiere acceso a la cámara.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.5,
      maxWidth: 1200, // Limitar ancho para reducir peso
      maxHeight: 1200, // Limitar alto
    });

    if (!result.canceled && fotos.length < 5) {
      setFotos([...fotos, result.assets[0].uri]);
    } else if (fotos.length >= 5) {
      Alert.alert('Límite excedido', 'Máximo 5 fotos de evidencia.');
    }
  };

  const handleSave = async () => {
    if (!formData.tipificacion) return Alert.alert('Error', 'Selecciona una tipificación final.');
    if (fotos.length === 0) return Alert.alert('Error', 'Debes adjuntar al menos 1 foto de evidencia.');
    
    setLoading(true);
    try {
      // ✅ VERIFICAR CONECTIVIDAD ANTES DE INTENTAR
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        throw new Error('Network Error'); // Forzar modo offline inmediatamente
      }

      const horaCierre = new Date().toISOString();
      const inicio = horaInicioVisita.current;
      const apertura = horaAperturaFicha.current || horaCierre;
      const duracionSeg = Math.round((new Date(horaCierre) - new Date(apertura)) / 1000);

      // Intentar envío normal
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key] ?? ''));
      data.append('hora_inicio_visita', inicio);
      data.append('hora_apertura_ficha', apertura);
      data.append('duracion_llenado_seg', String(duracionSeg));

      fotos.forEach((uri, index) => {
        const fileName = uri.split('/').pop();
        const fileType = fileName.split('.').pop();
        data.append('evidencias', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: fileName || `evidencia_${index}.jpg`,
          type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`
        });
      });

      await api.post(`/api/workers/clientes/${cliente.id}/ficha`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000, // 30 segundos máximo
      });
      
      // LOG DE MONITOREO (Segundo plano para no bloquear al usuario)
      const saveLog = (coords) => {
        api.post('/api/monitoreo/log', { 
          accion: 'FICHA_GUARDADA', 
          cliente_id: cliente.id,
          metadata: coords ? { lat: coords.latitude, lng: coords.longitude } : {}
        }).catch(e => {});
      };

      Location.getLastKnownPositionAsync().then(loc => {
        saveLog(loc?.coords);
      }).catch(() => {
        saveLog(null);
      });

      // SINCRONIZACIÓN LOCAL: Asegurar que el estado local coincida con el servidor
      const { updateLocalClientStatus } = require('../services/OfflineService');
      const finalStatus = formData.tipificacion === 'PAGO' ? 'VISITADO_PAGO' : 
                          formData.tipificacion === 'REPROGRAMARA' ? 'REPROGRAMADO' : 'NO_ENCONTRADO';
      await updateLocalClientStatus(cliente.id, finalStatus);

      Alert.alert('Éxito', 'Gestión guardada y sincronizada correctamente.', [
        { text: 'Finalizar', onPress: () => navigation.popToTop() }
      ]);
    } catch (err) {
      const isNetworkError = err.message === 'Network Error' || err.code === 'ECONNABORTED' || !err.response;
      const errorDetail = err.response?.data?.message || err.message;
      console.log('Error saving ficha:', errorDetail, '| isNetworkError:', isNetworkError);
      
      if (!isNetworkError) {
        // Error del servidor (400, 500...) — NO guardar offline, mostrar el error real
        await saveCrashLog(err, `SAVE_FICHA_SERVER_ERROR_${cliente.id}`);
        Alert.alert('Error del Servidor', `No se pudo guardar: ${errorDetail}`);
        return;
      }

      // Error de red — guardar offline
      await saveCrashLog(err, `SAVE_FICHA_OFFLINE_${cliente.id}`);
      const { saveFichaOffline } = require('../services/OfflineService');
      const saved = await saveFichaOffline(cliente.id, formData, fotos);
      
      if (saved) {
        Alert.alert(
          '📵 Sin Conexión',
          'La gestión se guardó LOCALMENTE. Se enviará al servidor automáticamente cuando recuperes conexión WiFi.',
          [{ text: 'Entendido', onPress: () => navigation.popToTop() }]
        );
      } else {
        Alert.alert('Error Grave', 'No se pudo guardar ni en línea ni localmente. Verifica el almacenamiento del teléfono.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* INDICADOR DE PASOS */}
      <View style={styles.stepIndicator}>
        <StepIcon active={step >= 1} current={step === 1} num="1" label="Validar" />
        <View style={styles.stepLine} />
        <StepIcon active={step >= 2} current={step === 2} num="2" label="Ficha" />
        <View style={styles.stepLine} />
        <StepIcon active={step >= 3} current={step === 3} num="3" label="Finalizar" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* PASO 1: VALIDACIÓN DE IDENTIDAD & DEUDA */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Corroborar Identidad & Deuda</Text>
            <Text style={styles.stepSub}>Valida los datos financieros y personales con el cliente.</Text>
            <View style={styles.dataCard}>
              <DataRow label="NOMBRE COMPLETO" val={`${cliente.nombres} ${cliente.apellidos}`} />
              <DataRow label="DNI / DOCUMENTO" val={cliente.dni} />
              <DataRow label="DEUDA TOTAL DE CARTERA" val={parseFloat(cliente.deuda_total || 0) > 0 ? `S/ ${parseFloat(cliente.deuda_total).toFixed(2)}` : 'S/ 0.00'} highlight />
              <DataRow label="TELÉFONO DE CONTACTO" val={cliente.telefono || 'No registrado'} />
              <DataRow label="DIRECCIÓN REGISTRADA" val={cliente.direccion} />
              <DataRow label="DISTRITO" val={cliente.distrito} />
            </View>
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
               <Text style={styles.nextBtnText}>DATOS CONFIRMADOS</Text>
               <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* PASO 2: FORMULARIO DE FICHA (DATOS DE NEGOCIO) */}
        {step === 2 && (() => {
          // Registrar apertura de ficha al entrar al paso 2
          if (!horaAperturaFicha.current) {
            horaAperturaFicha.current = new Date().toISOString();
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(loc => {
              api.post('/api/monitoreo/log', { 
                accion: 'FICHA_ABIERTA', 
                cliente_id: cliente.id,
                metadata: { lat: loc?.coords.latitude, lng: loc?.coords.longitude }
              }).catch(e => {});
            }).catch(() => {});
          }
          return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Información de Ficha</Text>
            <View style={styles.formGrid}>
               {cliente.plantilla_campos ? (
                 <>
                   <Text style={[styles.inputLabel, {color: '#00A9BC', fontWeight: 'bold'}]}>Formulario: {cliente.plantilla_nombre}</Text>
                   {(typeof cliente.plantilla_campos === 'string' ? JSON.parse(cliente.plantilla_campos) : cliente.plantilla_campos).map((field, idx) => (
                     <InputRow 
                       key={idx}
                       label={field.label} 
                       value={formData.dynamic_fields?.[field.label] || ''} 
                       onChange={(v) => {
                          const df = { ...(formData.dynamic_fields || {}) };
                          df[field.label] = v;
                          updateField('dynamic_fields', df);
                       }} 
                       placeholder={field.placeholder || ''} 
                       keyboard={field.type === 'number' ? 'numeric' : 'default'}
                     />
                   ))}
                 </>
               ) : (
                 <>
                   {/* Tipo de Crédito */}
                   <InputRow label="Tipo Crédito" value={formData.tipo_credito} onChange={(v) => updateField('tipo_credito', v)} placeholder="Ej. Personal, Hipotecario" />

                   {/* Fecha de Desembolso */}
                   <Text style={styles.inputLabel}>Fecha Desembolso</Text>
                   <View style={styles.dateDisplay}>
                     <Ionicons name="calendar-outline" size={16} color="#00A9BC" />
                     <Text style={styles.dateText}>{formData.fecha_desembolso}</Text>
                   </View>

                   {/* Monto + Moneda */}
                   <View style={styles.row}>
                      <View style={{flex:1, marginRight:10}}>
                         <InputRow label="Monto Desembolso" value={formData.monto_desembolso} onChange={(v) => updateField('monto_desembolso', v)} placeholder="0.00" keyboard="decimal-pad" />
                      </View>
                      <View style={{flex:0.6}}>
                         <Text style={styles.inputLabel}>Moneda</Text>
                         <View style={styles.pickerRow}>
                            <TouchableOpacity style={[styles.miniBtn, formData.moneda === 'PEN' && styles.miniBtnActive]} onPress={() => updateField('moneda', 'PEN')}><Text style={[styles.miniBtnText, formData.moneda === 'PEN' && styles.miniBtnTextActive]}>S/</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.miniBtn, formData.moneda === 'USD' && styles.miniBtnActive]} onPress={() => updateField('moneda', 'USD')}><Text style={[styles.miniBtnText, formData.moneda === 'USD' && styles.miniBtnTextActive]}>$</Text></TouchableOpacity>
                         </View>
                      </View>
                   </View>

                   {/* Cuotas */}
                   <View style={styles.row}>
                     <View style={{flex:1, marginRight:6}}>
                       <InputRow label="Cuotas Totales" value={formData.nro_cuotas} onChange={(v) => updateField('nro_cuotas', v)} placeholder="16" keyboard="numeric" />
                     </View>
                     <View style={{flex:1}}>
                       <InputRow label="Cuotas Pagadas" value={formData.nro_cuotas_pagadas} onChange={(v) => updateField('nro_cuotas_pagadas', v)} placeholder="14" keyboard="numeric" />
                     </View>
                   </View>

                   {/* Monto Cuota + Saldo */}
                   <View style={styles.row}>
                     <View style={{flex:1, marginRight:6}}>
                       <InputRow label="Monto Cuota" value={formData.monto_cuota} onChange={(v) => updateField('monto_cuota', v)} placeholder="150.50" keyboard="decimal-pad" />
                     </View>
                     <View style={{flex:1}}>
                       <InputRow label="Saldo Capital" value={formData.saldo_capital} onChange={(v) => updateField('saldo_capital', v)} placeholder="1200.00" keyboard="decimal-pad" />
                     </View>
                   </View>
                   
                   <Text style={styles.inputLabel}>Condición Contable</Text>
                   <View style={styles.pickerRowMB}>
                      {['MOROSO', 'RESPONSABLE'].map(c => (
                        <TouchableOpacity key={c} style={[styles.condBtn, formData.condicion_contable === c && styles.condBtnActive]} onPress={() => updateField('condicion_contable', c)}>
                          <Text style={[styles.condBtnText, formData.condicion_contable === c && styles.condBtnTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                   </View>
                 </>
               )}
            </View>

            <View style={styles.btnRow}>
               <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}><Text style={styles.backBtnText}>VOLVER</Text></TouchableOpacity>
               <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}><Text style={styles.nextBtnText}>CONTINUAR</Text></TouchableOpacity>
            </View>
          </View>
          );
        })()}

        {/* PASO 3: EVIDENCIA Y CIERRE */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Evidencia y Cierre</Text>
            <Text style={styles.stepSub}>Adjunta fotos (máx 5) y define el resultado de la visita.</Text>
            
            <View style={styles.photoGrid}>
              {fotos.map((uri, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity style={styles.delPhoto} onPress={() => setFotos(fotos.filter((_, idx)=> idx !== i))}>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {fotos.length < 5 && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                   <Ionicons name="camera" size={32} color="#00A9BC" />
                   <Text style={styles.addPhotoText}>Tomar Foto</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.inputLabel}>Resultado Final (Tipificación)</Text>
            <View style={styles.tipiGrid}>
               <TipiBtn label="PAGÓ" icon="cash" active={formData.tipificacion === 'PAGO'} onPress={() => updateField('tipificacion', 'PAGO')} color="#10b981" />
               <TipiBtn label="REPROGRAMAR" icon="calendar" active={formData.tipificacion === 'REPROGRAMARA'} onPress={() => updateField('tipificacion', 'REPROGRAMARA')} color="#f59e0b" />
               <TipiBtn label="NO ENCONTRADO" icon="person-remove" active={formData.tipificacion === 'NO_ENCONTRADO'} onPress={() => updateField('tipificacion', 'NO_ENCONTRADO')} color="#ef4444" />
            </View>

            <TextInput 
              style={styles.textArea} 
              placeholder="Observación detallada de la gestión..." 
              placeholderTextColor="#64748b"
              multiline 
              value={formData.observacion} 
              onChangeText={(v) => updateField('observacion', v)} 
            />

            <View style={styles.btnRow}>
               <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}><Text style={styles.backBtnText}>VOLVER</Text></TouchableOpacity>
               <TouchableOpacity 
                 style={[styles.saveBtn, loading && styles.btnDisabled]} 
                 onPress={handleSave} 
                 disabled={loading}
               >
                 {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>GUARDAR FICHA</Text>}
               </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const StepIcon = ({ active, current, num, label }) => (
  <View style={styles.stepIconContainer}>
     <View style={[styles.stepCircle, active && styles.stepCircleActive, current && styles.stepCircleCurrent]}>
        <Text style={[styles.stepNum, active && styles.stepNumActive]}>{num}</Text>
     </View>
     <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
  </View>
);

const DataRow = ({ label, val, highlight }) => (
  <View style={styles.dataRow}>
    <Text style={styles.dataLabel}>{label}</Text>
    <Text style={[styles.dataVal, highlight && styles.highlightVal]}>{val}</Text>
  </View>
);

const InputRow = ({ label, value, onChange, placeholder, keyboard="default" }) => (
  <View style={styles.inputBox}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput 
      style={styles.textInput} 
      value={value} 
      onChangeText={onChange} 
      placeholder={placeholder} 
      placeholderTextColor="#64748b"
      keyboardType={keyboard} 
    />
  </View>
);

const TipiBtn = ({ label, icon, active, onPress, color }) => (
  <TouchableOpacity style={[styles.tipiBtn, active && { borderColor: color, backgroundColor: color + '18' }]} onPress={onPress}>
    <Ionicons name={icon} size={24} color={active ? color : '#94a3b8'} />
    <Text style={[styles.tipiLabel, { color: active ? color : '#94a3b8' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  stepIndicator: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    padding: 15, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  stepIconContainer: { alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  stepCircleActive: { backgroundColor: '#00A9BC', borderColor: '#00A9BC' },
  stepCircleCurrent: { borderWidth: 2, borderColor: '#00A9BC' },
  stepNum: { fontSize: 11, fontWeight: 'bold', color: '#64748B' },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: 'bold' },
  stepLabelActive: { color: '#00A9BC' },
  stepLine: { width: 40, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 10, marginTop: -12 },
  scroll: { padding: 25 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 8 },
  stepSub: { color: '#64748B', fontSize: 13, marginBottom: 25 },
  dataCard: { 
    backgroundColor: '#FFFFFF', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 25, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
  },
  dataRow: { marginBottom: 15 },
  dataLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', letterSpacing: 0.5 },
  dataVal: { fontSize: 15, color: '#1E293B', fontWeight: '600', marginTop: 2 },
  highlightVal: { fontSize: 18, color: '#00A9BC', fontWeight: '950' },
  nextBtn: { flex: 1, backgroundColor: '#00A9BC', height: 55, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '800', marginRight: 10 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  backBtn: { height: 55, flex: 0.4, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#64748B', fontWeight: '800' },
  formGrid: { marginBottom: 20 },
  inputBox: { marginBottom: 15 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { 
    backgroundColor: '#F8FAFC', 
    height: 50, 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    fontSize: 14,
    color: '#1E293B'
  },
  row: { flexDirection: 'row' },
  pickerRow: { flexDirection: 'row', gap: 5 },
  pickerRowMB: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  miniBtn: { flex: 1, height: 45, backgroundColor: '#F8FAFC', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  miniBtnActive: { backgroundColor: '#00A9BC', borderColor: '#00A9BC' },
  miniBtnText: { color: '#64748B', fontWeight: 'bold' },
  miniBtnTextActive: { color: '#fff' },
  condBtn: { flex: 1, height: 45, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  condBtnActive: { backgroundColor: '#00A9BC', borderColor: '#00A9BC' },
  condBtnText: { fontSize: 11, color: '#64748B', fontWeight: '800' },
  condBtnTextActive: { color: '#fff' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 25, gap: 10 },
  photoWrap: { position: 'relative' },
  photoThumb: { width: width * 0.2, height: width * 0.2, borderRadius: 12 },
  delPhoto: { position: 'absolute', top: -5, right: -5 },
  addPhotoBtn: { 
    width: width * 0.2, 
    height: width * 0.2, 
    borderRadius: 12, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#00A9BC', 
    backgroundColor: '#F8FAFC',
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  addPhotoText: { fontSize: 8, color: '#00A9BC', marginTop: 4, textAlign: 'center', fontWeight: '800' },
  tipiGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  tipiBtn: { 
    flex: 1, 
    height: 80, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginHorizontal: 4 
  },
  tipiLabel: { fontSize: 9, fontWeight: '850', marginTop: 5, textAlign: 'center' },
  textArea: { 
    backgroundColor: '#F8FAFC', 
    padding: 15, 
    borderRadius: 16, 
    textAlignVertical: 'top', 
    height: 100, 
    marginBottom: 25, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    color: '#1E293B'
  },
  saveBtn: { flex: 1, backgroundColor: '#00A9BC', height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.7 },
  dateDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  dateText: { fontSize: 14, color: '#1E293B', fontWeight: '600' }
});
