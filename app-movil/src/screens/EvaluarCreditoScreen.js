import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Platform, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function EvaluarCreditoScreen({ navigation, route }) {
  const [dniSearch, setDniSearch] = useState(route.params?.cliente?.dni || '');
  const [loadingEval, setLoadingEval] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [step, setStep] = useState(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [formData, setFormData] = useState({
    dni: route.params?.cliente?.dni || '',
    apePat: '',
    apeMat: '',
    nombre: '',
    producto: 'Préstamo Personal',
    condicion: 'APTO',
    lineaCredito: 'Préstamo MYPE'
  });

  const handleBuscarSBS = () => {
    if (!dniSearch || dniSearch.length < 8) return;
    setLoadingEval(true);
    setEvalResult(null);

    // Simular consulta SBS
    setTimeout(() => {
      setEvalResult({
        nombre: 'JUAN PEREZ GONZALES',
        dni: dniSearch,
        fechaConsulta: new Date().toLocaleString('es-PE'),
        periodo: 'Diciembre-2025',
        rating: { normal: 0, problemas: 0, deficiente: 0, dudoso: 0, perdida: 100 },
        deudas: [
          { entidad: 'BANCO FALABELLA', calificacion: '4: Perdida', capital: 100, intereses: 31, total: 130 },
          { entidad: 'BBVA', calificacion: '4: Perdida', capital: 64, intereses: 30, total: 94 }
        ],
        lineas: [
          { entidad: 'BANCO FALABELLA', tipo: 'Tarjetas de crédito de consumo', total: 100 }
        ]
      });
      setLoadingEval(false);
    }, 2000);
  };

  const handleContinue = () => {
    let apePat = '';
    let apeMat = '';
    let nombres = '';
    
    if (evalResult?.nombre) {
      const parts = evalResult.nombre.split(' ');
      if (parts.length >= 3) {
        nombres = parts.slice(0, parts.length - 2).join(' ');
        apePat = parts[parts.length - 2];
        apeMat = parts[parts.length - 1];
      } else if (parts.length === 2) {
        nombres = parts[0];
        apePat = parts[1];
      } else {
        nombres = evalResult.nombre;
      }
    } else if (route.params?.cliente) {
      const c = route.params.cliente;
      nombres = c.nombres || '';
      if (c.apellidos) {
        const parts = c.apellidos.split(' ');
        apePat = parts[0] || '';
        apeMat = parts.slice(1).join(' ') || '';
      }
    }
    
    setFormData(prev => ({
      ...prev,
      dni: evalResult?.dni || prev.dni || route.params?.cliente?.dni || '',
      nombre: nombres,
      apePat: apePat,
      apeMat: apeMat,
    }));
    
    setStep(2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 2) {
            setStep(1);
          } else {
            navigation.goBack();
          }
        }}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Evaluación Crediticia</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 1 ? (
          <>
            {/* Buscador SBS */}
            <View style={styles.searchBox}>
              <Text style={styles.label}>Consultar DNI en SBS</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese DNI..."
                  keyboardType="number-pad"
                  maxLength={8}
                  value={dniSearch}
                  onChangeText={text => setDniSearch(text.replace(/[^0-9]/g, ''))}
                />
                <TouchableOpacity 
                  style={[styles.searchBtn, (loadingEval || dniSearch.length < 8) && { opacity: 0.5 }]} 
                  onPress={handleBuscarSBS}
                  disabled={loadingEval || dniSearch.length < 8}
                >
                  <Ionicons name="search" size={20} color="#FFF" />
                  <Text style={styles.searchBtnText}>Buscar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {loadingEval && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0CA678" />
                <Text style={styles.loadingText}>Conectando con la Superintendencia de Banca, Seguros y AFP...</Text>
              </View>
            )}

            {evalResult && !loadingEval && (
              <View style={styles.resultsContainer}>
                
                {/* Calificación Crediticia */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Calificación crediticia</Text>
                  </View>
                  
                  <View style={styles.ratingBar}>
                    <View style={[styles.ratingSegment, { backgroundColor: '#10B981' }]}><Text style={styles.ratingTextWhite}>Normal</Text></View>
                    <View style={[styles.ratingSegment, { backgroundColor: '#84CC16', flex: 1.5 }]}><Text style={styles.ratingTextWhite}>Prob. Potenc.</Text></View>
                    <View style={[styles.ratingSegment, { backgroundColor: '#EAB308' }]}><Text style={styles.ratingTextWhite}>Deficiente</Text></View>
                    <View style={[styles.ratingSegment, { backgroundColor: '#F97316' }]}><Text style={styles.ratingTextWhite}>Dudoso</Text></View>
                    <View style={[styles.ratingSegment, { backgroundColor: '#DC2626' }]}><Text style={styles.ratingTextWhite}>Pérdida</Text></View>
                  </View>
                  
                  <View style={styles.ratingValues}>
                    <Text style={[styles.ratingValue, { color: '#10B981' }]}>● {evalResult.rating.normal}%</Text>
                    <Text style={[styles.ratingValue, { color: '#84CC16' }]}>● {evalResult.rating.problemas}%</Text>
                    <Text style={[styles.ratingValue, { color: '#EAB308' }]}>● {evalResult.rating.deficiente}%</Text>
                    <Text style={[styles.ratingValue, { color: '#F97316' }]}>● {evalResult.rating.dudoso}%</Text>
                    <Text style={[styles.ratingValue, { color: '#DC2626' }]}>● {evalResult.rating.perdida}%</Text>
                  </View>
                  
                  <Text style={styles.disclaimer}>Cifras redondeadas. No se muestra información menor a 0.5%</Text>
                </View>

                {/* Metadatos */}
                <View style={styles.metaBox}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Fecha de Consulta</Text>
                    <Text style={styles.metaValue}>{evalResult.fechaConsulta}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Período Reportado</Text>
                    <Text style={styles.metaValue}>{evalResult.periodo}</Text>
                  </View>
                </View>

                {/* Detalle de deuda */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Detalle de deuda</Text>
                  </View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 0.5 }]}>No.</Text>
                    <Text style={[styles.th, { flex: 2 }]}>Entidad</Text>
                    <Text style={[styles.th, { flex: 1.5 }]}>Calif.</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Total</Text>
                  </View>
                  {evalResult.deudas.map((d, i) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={[styles.td, { flex: 0.5 }]}>{i + 1}</Text>
                      <Text style={[styles.td, { flex: 2, fontWeight: 'bold' }]}>{d.entidad}</Text>
                      <Text style={[styles.td, { flex: 1.5, color: '#DC2626' }]}>● {d.calificacion.split(':')[1]}</Text>
                      <Text style={[styles.td, { flex: 1.5, textAlign: 'right', fontWeight: 'bold' }]}>S/. {d.total}</Text>
                    </View>
                  ))}
                </View>

                {/* Líneas de Crédito */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Líneas de crédito</Text>
                  </View>
                  <Text style={styles.subtitle}>Líneas de crédito otorgadas y que no han sido usadas.</Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 2 }]}>Entidad</Text>
                    <Text style={[styles.th, { flex: 2 }]}>Tipo</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Línea</Text>
                  </View>
                  {evalResult.lineas.map((l, i) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={[styles.td, { flex: 2, fontWeight: 'bold' }]}>{l.entidad}</Text>
                      <Text style={[styles.td, { flex: 2 }]}>{l.tipo}</Text>
                      <Text style={[styles.td, { flex: 1.5, textAlign: 'right', fontWeight: 'bold' }]}>S/. {l.total}</Text>
                    </View>
                  ))}
                </View>

                {/* Botón continuar */}
                <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
                  <Text style={styles.continueBtnText}>CONTINUAR</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </TouchableOpacity>

              </View>
            )}
          </>
        ) : (
          <View style={styles.resultsContainer}>
            
            {/* Datos Personales */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Datos Personales</Text>
              </View>
              <View style={{ padding: 16, gap: 16 }}>
                <View>
                  <Text style={styles.formLabel}>DNI</Text>
                  <TextInput 
                    style={styles.input} 
                    value={formData.dni} 
                    onChangeText={t => setFormData({...formData, dni: t})} 
                    keyboardType="number-pad" 
                    maxLength={8} 
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Ape. Paterno</Text>
                    <TextInput 
                      style={styles.input} 
                      value={formData.apePat} 
                      onChangeText={t => setFormData({...formData, apePat: t})} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Ape. Materno</Text>
                    <TextInput 
                      style={styles.input} 
                      value={formData.apeMat} 
                      onChangeText={t => setFormData({...formData, apeMat: t})} 
                    />
                  </View>
                </View>
                <View>
                  <Text style={styles.formLabel}>Nombres</Text>
                  <TextInput 
                    style={styles.input} 
                    value={formData.nombre} 
                    onChangeText={t => setFormData({...formData, nombre: t})} 
                  />
                </View>
              </View>
            </View>

            {/* Aprobación y Producto */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Resolución de Crédito</Text>
              </View>
              <View style={{ padding: 16, gap: 16 }}>
                <View>
                  <Text style={styles.formLabel}>Tipo de Producto</Text>
                  <TextInput 
                    style={styles.input} 
                    value={formData.producto} 
                    onChangeText={t => setFormData({...formData, producto: t})} 
                  />
                </View>

                <View>
                  <Text style={styles.formLabel}>Condición</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={[styles.selectorBtn, formData.condicion === 'APTO' && styles.selectorBtnActiveApto]}
                      onPress={() => setFormData({...formData, condicion: 'APTO'})}>
                      <Text style={[styles.selectorBtnText, formData.condicion === 'APTO' && styles.selectorBtnTextActive]}>APTO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.selectorBtn, formData.condicion === 'NO APTO' && styles.selectorBtnActiveNoApto]}
                      onPress={() => setFormData({...formData, condicion: 'NO APTO'})}>
                      <Text style={[styles.selectorBtnText, formData.condicion === 'NO APTO' && styles.selectorBtnTextActive]}>NO APTO</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text style={styles.formLabel}>Línea de Crédito Aprobada</Text>
                  <TouchableOpacity 
                    style={styles.dropdownTrigger}
                    onPress={() => setShowDropdown(true)}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {formData.lineaCredito || 'Seleccione una línea...'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Submit Final */}
            <View style={{ alignItems: 'center', marginTop: 30, marginBottom: 20 }}>
              <Image source={require('../../assets/logo-informatech.png')} style={{ width: 140, height: 40, resizeMode: 'contain', opacity: 0.7 }} />
              <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 12, marginBottom: 24, lineHeight: 14, paddingHorizontal: 10 }}>
                Al solicitar este préstamo, el cliente acepta los términos y condiciones de la entidad financiera. 
                Tus datos son tratados de acuerdo a la Ley N° 29733 de Protección de Datos Personales.
              </Text>
              <TouchableOpacity style={styles.finalSubmitBtn} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.finalSubmitBtnText}>SOLICITAR PRÉSTAMO</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}
      </ScrollView>

      {/* Dropdown Modal Selection */}
      <Modal visible={showDropdown} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1} 
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownMenu}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownHeaderTitle}>Seleccionar Línea de Crédito</Text>
            </View>
            {['Préstamo MYPE', 'Crédito Consumo', 'Tarjeta de Crédito', 'Préstamo Vehicular', 'Préstamo Hipotecario'].map(opt => (
              <TouchableOpacity 
                key={opt}
                style={[styles.dropdownItem, formData.lineaCredito === opt && styles.dropdownItemActive]}
                onPress={() => {
                  setFormData({...formData, lineaCredito: opt});
                  setShowDropdown(false);
                }}
              >
                <Text style={[styles.dropdownItemText, formData.lineaCredito === opt && styles.dropdownItemTextActive]}>
                  {opt}
                </Text>
                {formData.lineaCredito === opt && (
                  <Ionicons name="checkmark-circle" size={20} color="#4263EB" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E0' },
  backBtn: { marginRight: 15 },
  title: { fontSize: 20, fontWeight: '900', color: '#1A1A1A' },
  scroll: { padding: 20, paddingBottom: 100 },
  searchBox: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E5E0', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#1A1A1A', height: 50 },
  searchBtn: { backgroundColor: '#4263EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12, height: 50 },
  searchBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { color: '#6B7280', marginTop: 16, textAlign: 'center', fontSize: 15, fontWeight: '500' },
  resultsContainer: { gap: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5E0', overflow: 'hidden' },
  cardHeader: { backgroundColor: '#64748B', padding: 12 },
  cardTitle: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  ratingBar: { flexDirection: 'row', width: '100%' },
  ratingSegment: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  ratingTextWhite: { color: '#FFF', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  ratingValues: { flexDirection: 'row', width: '100%', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E5E5E0' },
  ratingValue: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 'bold' },
  disclaimer: { fontSize: 11, color: '#6B7280', padding: 12 },
  metaBox: { gap: 8 },
  metaRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E0', borderRadius: 8, overflow: 'hidden' },
  metaLabel: { backgroundColor: '#F8FAFC', padding: 12, width: 140, fontWeight: 'bold', fontSize: 12, color: '#475569', borderRightWidth: 1, borderRightColor: '#E5E5E0' },
  metaValue: { flex: 1, padding: 12, fontSize: 13, color: '#1A1A1A', fontWeight: '500' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E5E5E0', paddingHorizontal: 12, paddingVertical: 10 },
  th: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E5E0', paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  td: { fontSize: 12, color: '#1A1A1A' },
  subtitle: { fontSize: 12, color: '#64748B', padding: 12, paddingBottom: 0 },
  formLabel: { fontSize: 13, fontWeight: 'bold', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectorBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, alignItems: 'center' },
  selectorBtnActiveApto: { backgroundColor: '#0CA678', borderColor: '#0CA678' },
  selectorBtnActiveNoApto: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  selectorBtnText: { fontWeight: 'bold', color: '#64748B' },
  selectorBtnTextActive: { color: '#FFF' },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  dropdownTriggerText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#E5E5E0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  dropdownHeader: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },
  dropdownHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E0',
  },
  dropdownItemActive: {
    backgroundColor: '#F1F5F9',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#4263EB',
    fontWeight: 'bold',
  },
  continueBtn: { backgroundColor: '#1A1A1A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 10 },
  continueBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginRight: 8 },
  finalSubmitBtn: { backgroundColor: '#10B981', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  finalSubmitBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }
});
