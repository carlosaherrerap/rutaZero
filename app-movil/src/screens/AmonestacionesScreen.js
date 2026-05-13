import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, Alert, ActivityIndicator, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

const AmonestacionesScreen = () => {
  const { api } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [signatureModal, setSignatureModal] = useState(false);
  const webviewRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await api.get('/api/trabajadores/mis-amonestaciones');
      setData(res.data.data);
    } catch (e) {
      console.log('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSign = async (signatureBase64) => {
    try {
      await api.post(`/api/trabajadores/firmar-amonestacion/${selected.id}`, { firma: signatureBase64 });
      Alert.alert('Éxito', 'Documento firmado digitalmente');
      setSignatureModal(false);
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la firma');
    }
  };

  // HTML para el canvas de firma en el WebView (ligero y sin dependencias externas)
  const signatureHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body { margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: sans-serif; background: #fff; }
        canvas { flex: 1; border: 2px dashed #cbd5e1; margin: 10px; border-radius: 8px; }
        .controls { padding: 10px; display: flex; gap: 10px; }
        button { flex: 1; padding: 15px; border-radius: 8px; border: none; font-weight: bold; font-size: 16px; }
        .clear { background: #f1f5f9; color: #475569; }
        .save { background: #3b82f6; color: white; }
      </style>
    </head>
    <body>
      <h3 style="text-align:center; color:#1e293b;">Firma aquí</h3>
      <canvas id="signature-pad"></canvas>
      <div class="controls">
        <button class="clear" onclick="clearPad()">Limpiar</button>
        <button class="save" onclick="savePad()">Guardar Firma</button>
      </div>
      <script>
        const canvas = document.getElementById('signature-pad');
        const ctx = canvas.getContext('2d');
        let drawing = false;

        function resize() {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
        }
        window.onresize = resize;
        resize();

        function start(e) { drawing = true; draw(e); }
        function end() { drawing = false; ctx.beginPath(); }
        function draw(e) {
          if (!drawing) return;
          const rect = canvas.getBoundingClientRect();
          const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
          const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#1e293b';
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
        }

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', end);
        canvas.addEventListener('touchstart', start);
        canvas.addEventListener('touchmove', draw);
        window.addEventListener('touchend', end);

        function clearPad() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
        function savePad() {
          const data = canvas.toDataURL('image/png');
          window.ReactNativeWebView.postMessage(data);
        }
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Amonestaciones</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardType}>{item.tipo}</Text>
                <Text style={styles.cardDate}>{item.fecha}</Text>
                <Text style={styles.cardDesc}>{item.descripcion}</Text>
              </View>
              {item.estado === 'PENDIENTE' ? (
                <TouchableOpacity 
                  style={styles.signBtn} 
                  onPress={() => { setSelected(item); setSignatureModal(true); }}
                >
                  <Ionicons name="pencil" size={18} color="#fff" />
                  <Text style={styles.signBtnText}>FIRMAR</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.signedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.signedText}>FIRMADO</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={signatureModal} animationType="fade">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSignatureModal(false)}>
              <Ionicons name="close" size={28} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Firma Digital</Text>
            <View style={{ width: 28 }} />
          </View>
          <WebView
            ref={webviewRef}
            source={{ html: signatureHtml }}
            onMessage={(e) => handleSign(e.nativeEvent.data)}
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  list: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 15, elevation: 2, flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardType: { fontSize: 16, fontWeight: '700', color: '#ef4444' },
  cardDate: { fontSize: 12, color: '#94a3b8', marginVertical: 4 },
  cardDesc: { fontSize: 13, color: '#64748b' },
  signBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  signBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  signedBadge: { flexDirection: 'row', alignItems: 'center' },
  signedText: { color: '#10b981', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  modalHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalHeaderTitle: { fontSize: 16, fontWeight: 'bold' }
});

export default AmonestacionesScreen;
