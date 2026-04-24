import React, { useState, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  ScrollView, Alert, ActivityIndicator, Image, Dimensions, Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      mediaTypes: ['images'], // Nueva API no deprecada
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
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
      });
      
      Alert.alert('Éxito', 'Gestión guardada y sincronizada correctamente.', [
        { text: 'Finalizar', onPress: () => navigation.popToTop() }
      ]);
    } catch (err) {
      console.log('Error saving ficha, attempting offline storage:', err);
      
      // FALLBACK OFFLINE
      const { saveFichaOffline } = require('../services/OfflineService');
      const saved = await saveFichaOffline(cliente.id, formData, fotos);
      
      if (saved) {
        Alert.alert(
          'Modo Offline Activo', 
          'No se pudo conectar con el servidor, pero la gestión se guardó LOCALMENTE en tu teléfono. Se sincronizará automáticamente cuando recuperes conexión.',
          [{ text: 'Entendido', onPress: () => navigation.popToTop() }]
        );
      } else {
        Alert.alert('Error Grave', 'No se pudo guardar ni siquiera de forma local. Verifica el espacio en tu teléfono.');
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
        {/* PASO 1: VALIDACIÓN DE IDENTIDAD */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Corroborar Identidad</Text>
            <Text style={styles.stepSub}>Valida los datos con el cliente antes de proceder.</Text>
            <View style={styles.dataCard}>
              <DataRow label="NOMBRE COMPLETO" val={`${cliente.nombres} ${cliente.apellidos}`} />
              <DataRow label="DNI / DOCUMENTO" val={cliente.dni} />
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
          if (!horaAperturaFicha.current) horaAperturaFicha.current = new Date().toISOString();
          return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Información de Ficha</Text>
            <View style={styles.formGrid}>
               {/* Tipo de Crédito */}
               <InputRow label="Tipo Crédito" value={formData.tipo_credito} onChange={(v) => updateField('tipo_credito', v)} placeholder="Ej. Personal, Hipotecario" />

               {/* Fecha de Desembolso */}
               <Text style={styles.inputLabel}>Fecha Desembolso</Text>
               <View style={styles.dateDisplay}>
                 <Ionicons name="calendar-outline" size={16} color="#64748b" />
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
                        <TouchableOpacity style={[styles.miniBtn, formData.moneda === 'PEN' && styles.miniBtnActive]} onPress={() => updateField('moneda', 'PEN')}><Text style={styles.miniBtnText}>S/</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.miniBtn, formData.moneda === 'USD' && styles.miniBtnActive]} onPress={() => updateField('moneda', 'USD')}><Text style={styles.miniBtnText}>$</Text></TouchableOpacity>
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
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {fotos.length < 5 && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                   <Ionicons name="camera" size={32} color="#3b82f6" />
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

const DataRow = ({ label, val }) => (
  <View style={styles.dataRow}>
    <Text style={styles.dataLabel}>{label}</Text>
    <Text style={styles.dataVal}>{val}</Text>
  </View>
);

const InputRow = ({ label, value, onChange, placeholder, keyboard="default" }) => (
  <View style={styles.inputBox}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput style={styles.textInput} value={value} onChangeText={onChange} placeholder={placeholder} keyboardType={keyboard} />
  </View>
);

const TipiBtn = ({ label, icon, active, onPress, color }) => (
  <TouchableOpacity style={[styles.tipiBtn, active && { borderColor: color, backgroundColor: color + '10' }]} onPress={onPress}>
    <Ionicons name={icon} size={24} color={active ? color : '#94a3b8'} />
    <Text style={[styles.tipiLabel, active && { color: color }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  stepIndicator: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  stepIconContainer: { alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  stepCircleActive: { backgroundColor: '#3b82f6' },
  stepCircleCurrent: { borderWidth: 2, borderColor: '#bfdbfe' },
  stepNum: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8' },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: 'bold' },
  stepLabelActive: { color: '#3b82f6' },
  stepLine: { width: 40, height: 2, backgroundColor: '#f1f5f9', marginHorizontal: 10, marginTop: -12 },
  scroll: { padding: 25 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  stepSub: { color: '#64748b', fontSize: 13, marginBottom: 25 },
  dataCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 25, elevation: 3 },
  dataRow: { marginBottom: 15 },
  dataLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '800' },
  dataVal: { fontSize: 15, color: '#1e293b', fontWeight: '600', marginTop: 2 },
  nextBtn: { flex: 1, backgroundColor: '#3b82f6', height: 55, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '800', marginRight: 10 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  backBtn: { height: 55, flex: 0.4, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#94a3b8', fontWeight: '800' },
  formGrid: { marginBottom: 20 },
  inputBox: { marginBottom: 15 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, textTransform: 'uppercase' },
  textInput: { backgroundColor: '#fff', height: 50, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 14 },
  row: { flexDirection: 'row' },
  pickerRow: { flexDirection: 'row', gap: 5 },
  pickerRowMB: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  miniBtn: { flex: 1, height: 45, backgroundColor: '#f1f5f9', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  miniBtnActive: { backgroundColor: '#334155' },
  miniBtnText: { color: '#64748b', fontWeight: 'bold' },
  condBtn: { flex: 1, height: 45, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  condBtnActive: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
  condBtnText: { fontSize: 11, color: '#64748b', fontWeight: '800' },
  condBtnTextActive: { color: '#fff' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 25, gap: 10 },
  photoWrap: { position: 'relative' },
  photoThumb: { width: width * 0.2, height: width * 0.2, borderRadius: 12 },
  delPhoto: { position: 'absolute', top: -5, right: -5 },
  addPhotoBtn: { width: width * 0.2, height: width * 0.2, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  addPhotoText: { fontSize: 8, color: '#3b82f6', marginTop: 4, textAlign: 'center' },
  tipiGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  tipiBtn: { flex: 1, height: 80, backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  tipiLabel: { fontSize: 9, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  textArea: { backgroundColor: '#fff', padding: 15, borderRadius: 16, textAlignVertical: 'top', height: 100, marginBottom: 25, borderWidth: 1, borderColor: '#e2e8f0' },
  saveBtn: { flex: 1, backgroundColor: '#1e293b', height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.7 },
  dateDisplay: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 14, marginBottom: 15 },
  dateText: { fontSize: 14, color: '#334155', fontWeight: '600' }
});
