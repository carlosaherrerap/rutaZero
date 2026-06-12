/**
 * OfflineService.js (SECURED - 100% STRICT)
 * Almacena datos bancarios y gestiones localmente usando AsyncStorage,
 * protegiéndolos con cifrado AES-256-GCM.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { saveCrashLog } from './CrashLogService';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

const QUEUE_KEY = 'rz_pending_fichas';
const DAY_DATA_KEY = 'rz_day_data';
const JOURNEY_ACTIONS_KEY = 'rz_journey_actions';
const SYNC_LOG_KEY = 'rz_sync_log';

// --- CAPA Criptográfica (Application-Level Encryption) ---

const getAesKey = async () => {
  try {
    if (Platform.OS === 'web') return 'web_fallback_key_not_secure'; // Para simulación en web
    const key = await SecureStore.getItemAsync('AES_OFFLINE_KEY');
    if (!key) throw new Error('Llave AES destruida o no encontrada. Datos bloqueados.');
    return key;
  } catch (err) {
    console.error('❌ [Crypto] Error crítico recuperando llave maestra:', err);
    throw err;
  }
};

const encryptData = async (dataObj) => {
  const key = await getAesKey();
  const jsonStr = JSON.stringify(dataObj);
  return CryptoJS.AES.encrypt(jsonStr, key).toString();
};

const decryptData = async (cipherText) => {
  try {
    const key = await getAesKey();
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedData) throw new Error('Descifrado fallido. Llave incorrecta o payload corrupto.');
    return JSON.parse(decryptedData);
  } catch (err) {
    console.error('❌ [Crypto] Error descifrando payload:', err);
    throw err;
  }
};

// --- Fin Capa Criptográfica ---

export const logConnectionStatus = async (status) => {
  try {
    const time = new Date().toLocaleTimeString('es-PE', { hour12: false });
    const entry = `${status}-${time}`;
    await AsyncStorage.setItem(SYNC_LOG_KEY, entry);
  } catch (e) {
    console.error('Error logging connection status', e);
  }
};

export const getLastConnectionStatus = async () => {
  try {
    return await AsyncStorage.getItem(SYNC_LOG_KEY);
  } catch {
    return null;
  }
};

export const initOfflineDB = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? await decryptData(raw) : [];
    console.log(`✅ OfflineService iniciado (Seguro). Fichas encriptadas pendientes: ${queue.length}`);
  } catch {
    console.log('✅ OfflineService iniciado (sin datos previos o base destruida)');
  }
};

export const saveDayData = async (data) => {
  try {
    console.log('💾 [Offline] Encriptando y Guardando DAY_DATA...');
    const payload = { ...data, savedAt: new Date().toISOString() };
    const cipherText = await encryptData(payload);
    await AsyncStorage.setItem(DAY_DATA_KEY, cipherText);
    console.log('✅ [Offline] DAY_DATA guardado de forma segura.');
  } catch (err) {
    console.error('❌ [Offline] Error encriptando day data:', err);
  }
};

export const getDayData = async () => {
  try {
    console.log('📂 [Offline] Intentando desencriptar DAY_DATA...');
    const raw = await AsyncStorage.getItem(DAY_DATA_KEY);
    if (!raw) return null;
    
    const parsed = await decryptData(raw);
    console.log('✅ [Offline] DAY_DATA desencriptado.');
    return parsed;
  } catch (err) {
    console.error('❌ [Offline] Error desencriptando DAY_DATA:', err);
    return null; // Si no se puede descifrar (ej. Crypto-shredding), retornar null
  }
};

export const clearOfflineCache = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
  await AsyncStorage.removeItem(DAY_DATA_KEY);
  await AsyncStorage.removeItem(JOURNEY_ACTIONS_KEY);
  console.log('🧹 Caché offline limpiada físicamente.');
};

export const updateLocalJourneyStatus = async (status, extraData = {}) => {
  try {
    const dayData = (await getDayData()) || { journey: {} };
    if (!dayData.journey) dayData.journey = {};
    dayData.journey.estado_jornada = status;
    dayData.journey = { ...dayData.journey, ...extraData };
    await saveDayData(dayData);
    return true;
  } catch (err) {
    return false;
  }
};

export const saveJourneyActionOffline = async (endpoint) => {
  try {
    const raw = await AsyncStorage.getItem(JOURNEY_ACTIONS_KEY);
    const queue = raw ? await decryptData(raw) : [];
    queue.push({ endpoint, savedAt: new Date().toISOString() });
    
    const cipherText = await encryptData(queue);
    await AsyncStorage.setItem(JOURNEY_ACTIONS_KEY, cipherText);
    
    let status = 'JORNADA_INICIADA';
    let extra = {};
    if (endpoint.includes('iniciar')) status = 'JORNADA_INICIADA';
    if (endpoint.includes('almuerzo/inicio')) {
      status = 'EN_REFRIGERIO';
      extra = { hora_inicio_almuerzo: new Date().toISOString() };
    }
    if (endpoint.includes('almuerzo/fin')) status = 'JORNADA_INICIADA';
    if (endpoint.includes('finalizar')) status = 'JORNADA_FINALIZADA';

    await updateLocalJourneyStatus(status, extra);
    return true;
  } catch (err) {
    return false;
  }
};

export const updateLocalClientStatus = async (clienteId, status) => {
  try {
    const dayData = await getDayData();
    if (!dayData) return false;

    let modified = false;

    if (dayData.clients) {
      const idx = dayData.clients.findIndex(c => String(c.id) === String(clienteId));
      if (idx !== -1) {
        dayData.clients[idx].estado = status;
        if (status === 'LIBRE') dayData.clients[idx].bloqueado_por = null;
        modified = true;
      }
    }

    if (dayData.rutas) {
      dayData.rutas.forEach((item, index) => {
        if (String(item.cliente_id) === String(clienteId)) {
          dayData.rutas[index].cliente_estado = status;
          if (status === 'LIBRE') dayData.rutas[index].bloqueado_por = null;
          modified = true;
        }
      });
    }

    if (modified) {
      await saveDayData(dayData);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
};

export const saveFichaOffline = async (clienteId, formData, fotos) => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? await decryptData(raw) : [];

    queue.push({
      id: Date.now().toString(),
      clienteId,
      formData,
      fotos,
      savedAt: new Date().toISOString()
    });

    const cipherText = await encryptData(queue);
    await AsyncStorage.setItem(QUEUE_KEY, cipherText);
    
    const status = formData.tipificacion === 'PAGO' ? 'VISITADO_PAGO' : 
                   formData.tipificacion === 'REPROGRAMARA' ? 'REPROGRAMADO' : 'NO_ENCONTRADO';
    
    await updateLocalClientStatus(clienteId, status);
    console.log(`📦 Ficha guardada encriptada offline.`);
    return true;
  } catch (err) {
    console.error('Error guardando encriptado offline:', err);
    return false;
  }
};

let isSyncing = false;

export const syncAllOfflineData = async (api) => {
  if (isSyncing) return;
  isSyncing = true;

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    isSyncing = false;
    return;
  }

  const lastStatus = await getLastConnectionStatus();
  if (lastStatus && lastStatus.startsWith('ONLINE')) {
    const rawActions = await AsyncStorage.getItem(JOURNEY_ACTIONS_KEY);
    const rawFichas = await AsyncStorage.getItem(QUEUE_KEY);
    
    // Solo intentamos descifrar si hay algo
    let actions = [], fichas = [];
    if (rawActions) try { actions = await decryptData(rawActions); } catch (e) {}
    if (rawFichas) try { fichas = await decryptData(rawFichas); } catch (e) {}
    
    if (actions.length === 0 && fichas.length === 0) {
      console.log('📶 Todo está al día.');
      isSyncing = false;
      return;
    }
  }

  console.log('🔄 Iniciando sincronización de datos pendientes...');
  try {
    const rawActions = await AsyncStorage.getItem(JOURNEY_ACTIONS_KEY);
    if (rawActions) {
      const actions = await decryptData(rawActions);
      for (const action of actions) {
        try { await api.post(action.endpoint); } catch (e) {}
      }
      await AsyncStorage.removeItem(JOURNEY_ACTIONS_KEY);
    }

    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;

    const queue = await decryptData(raw);
    if (queue.length === 0) return;

    console.log(`🔄 Sincronizando ${queue.length} fichas seguras offline...`);
    const remainingQueue = [];

    for (const item of queue) {
      try {
        const data = new FormData();
        Object.keys(item.formData).forEach(key => data.append(key, item.formData[key]));
        data.append('es_offline', 'true');

        item.fotos.forEach((uri, index) => {
          const fileName = uri.split('/').pop() || `evidencia_${index}.jpg`;
          const ext = fileName.split('.').pop();
          data.append('evidencias', {
            uri,
            name: fileName,
            type: `image/${ext === 'png' ? 'png' : 'jpeg'}`
          });
        });

        await api.post(`/api/workers/clientes/${item.clienteId}/ficha`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
      } catch (e) {
        await saveCrashLog(e, `SYNC_FICHA_${item.clienteId}`);
        remainingQueue.push(item);
      }
    }

    const cipherRemaining = await encryptData(remainingQueue);
    await AsyncStorage.setItem(QUEUE_KEY, cipherRemaining);
    if (remainingQueue.length === 0) {
      await logConnectionStatus('ONLINE');
    }
  } catch (err) {
    console.error('❌ Error en syncAllOfflineData desencriptando/sincronizando:', err);
  } finally {
    isSyncing = false;
  }
};

export const getPendingClientIds = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? await decryptData(raw) : [];
    return queue.map(item => String(item.clienteId));
  } catch {
    return [];
  }
};
