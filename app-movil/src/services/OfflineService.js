/**
 * OfflineService.js
 * Guarda gestiones localmente con AsyncStorage cuando no hay internet.
 * Las fotos se guardan por referencia de URI (sin copiar archivos).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { saveCrashLog } from './CrashLogService';

const QUEUE_KEY = 'rz_pending_fichas';
const DAY_DATA_KEY = 'rz_day_data';
const JOURNEY_ACTIONS_KEY = 'rz_journey_actions';
const SYNC_LOG_KEY = 'rz_sync_log';

/**
 * Registra el estado de conexión con timestamp.
 */
export const logConnectionStatus = async (status) => {
  try {
    const time = new Date().toLocaleTimeString('es-PE', { hour12: false });
    const entry = `${status}-${time}`;
    await AsyncStorage.setItem(SYNC_LOG_KEY, entry);
    console.log(`📡 Estado registrado: ${entry}`);
  } catch (e) {
    console.error('Error logging connection status', e);
  }
};

/**
 * Obtiene el último estado de conexión registrado.
 */
export const getLastConnectionStatus = async () => {
  try {
    return await AsyncStorage.getItem(SYNC_LOG_KEY);
  } catch {
    return null;
  }
};

/**
 * Inicialización: muestra cuántos items hay pendientes en cola
 */
export const initOfflineDB = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    console.log(`✅ OfflineService iniciado. Fichas pendientes: ${queue.length}`);
  } catch {
    console.log('✅ OfflineService iniciado (sin datos previos)');
  }
};

/**
 * Guarda los datos del día (clientes, rutas, estado de jornada)
 */
export const saveDayData = async (data) => {
  try {
    console.log('💾 [Offline] Guardando DAY_DATA...', {
      hasJourney: !!data.journey,
      clientsCount: data.clients?.length,
      rutasCount: data.rutas?.length
    });
    await AsyncStorage.setItem(DAY_DATA_KEY, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }));
    console.log('✅ [Offline] DAY_DATA guardado con éxito');
  } catch (err) {
    console.error('❌ [Offline] Error saving day data:', err);
  }
};

/**
 * Obtiene los datos del día guardados localmente
 */
export const getDayData = async () => {
  try {
    console.log('📂 [Offline] Intentando leer DAY_DATA...');
    const raw = await AsyncStorage.getItem(DAY_DATA_KEY);
    if (!raw) {
      console.log('⚠️ [Offline] No se encontró DAY_DATA en AsyncStorage');
      return null;
    }
    const parsed = JSON.parse(raw);
    console.log('✅ [Offline] DAY_DATA recuperado:', {
      savedAt: parsed.savedAt,
      hasJourney: !!parsed.journey,
      clients: parsed.clients?.length
    });
    return parsed;
  } catch (err) {
    console.error('❌ [Offline] Error leyendo DAY_DATA:', err);
    return null;
  }
};

/**
 * Limpia TODA la caché local (al final del día)
 */
export const clearOfflineCache = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
  await AsyncStorage.removeItem(DAY_DATA_KEY);
  await AsyncStorage.removeItem(JOURNEY_ACTIONS_KEY);
  console.log('🧹 Caché offline totalmente limpiada');
};

/**
 * Actualiza el estado de la jornada en el caché local (DAY_DATA)
 */
export const updateLocalJourneyStatus = async (status, extraData = {}) => {
  try {
    const dayData = (await getDayData()) || { journey: {} };
    if (!dayData.journey) dayData.journey = {};
    
    dayData.journey.estado_jornada = status;
    dayData.journey = { ...dayData.journey, ...extraData };
    
    await saveDayData(dayData);
    console.log(`🏠 Caché local actualizado: ${status}`);
    return true;
  } catch (err) {
    console.error('Error actualizando estado local:', err);
    return false;
  }
};

/**
 * Guarda una acción de jornada (iniciar, almuerzo, etc) en cola
 */
export const saveJourneyActionOffline = async (endpoint) => {
  try {
    const raw = await AsyncStorage.getItem(JOURNEY_ACTIONS_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ endpoint, savedAt: new Date().toISOString() });
    await AsyncStorage.setItem(JOURNEY_ACTIONS_KEY, JSON.stringify(queue));
    
    // Mapear endpoint a estado
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

/**
 * Actualiza el estado de un cliente específico en el caché local
 */
export const updateLocalClientStatus = async (clienteId, status) => {
  try {
    const dayData = await getDayData();
    if (!dayData || !dayData.clients) return false;

    const idx = dayData.clients.findIndex(c => String(c.id) === String(clienteId));
    if (idx !== -1) {
      dayData.clients[idx].estado = status;
      // Si el estado es LIBRE, también limpiamos quién lo bloqueó
      if (status === 'LIBRE') {
        dayData.clients[idx].bloqueado_por = null;
      }
      await saveDayData(dayData);
      console.log(`📦 Cliente ${clienteId} actualizado localmente a ${status}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error actualizando cliente local:', err);
    return false;
  }
};

/**
 * Guarda una ficha en la cola local cuando el servidor no está disponible.
 */
export const saveFichaOffline = async (clienteId, formData, fotos) => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];

    queue.push({
      id: Date.now().toString(),
      clienteId,
      formData,
      fotos,
      savedAt: new Date().toISOString()
    });

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Marcar cliente como gestionado localmente
    const status = formData.tipificacion === 'PAGO' ? 'VISITADO_PAGO' : 
                   formData.tipificacion === 'REPROGRAMARA' ? 'REPROGRAMADO' : 'NO_ENCONTRADO';
    
    await updateLocalClientStatus(clienteId, status);

    console.log(`📦 Ficha guardada offline. Total en cola: ${queue.length}`);
    return true;
  } catch (err) {
    console.error('Error guardando offline:', err);
    return false;
  }
};

let isSyncing = false;

/**
 * Sincroniza todo lo pendiente (acciones de jornada y fichas)
 */
export const syncAllOfflineData = async (api) => {
  if (isSyncing) {
    console.log('⏳ Sincronización en curso. Esperando...');
    return;
  }
  isSyncing = true;

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    isSyncing = false;
    return;
  }

  const lastStatus = await getLastConnectionStatus();
  // Si la última gestión fue ONLINE y seguimos con internet, no intentamos resincronizar
  if (lastStatus && lastStatus.startsWith('ONLINE')) {
    const rawActions = await AsyncStorage.getItem(JOURNEY_ACTIONS_KEY);
    const rawFichas = await AsyncStorage.getItem(QUEUE_KEY);
    const actions = rawActions ? JSON.parse(rawActions) : [];
    const fichas = rawFichas ? JSON.parse(rawFichas) : [];
    
    if (actions.length === 0 && fichas.length === 0) {
      console.log('📶 Todo está al día. Saltando revisión de cola.');
      isSyncing = false;
      return;
    }
  }

  console.log('🔄 Iniciando sincronización de datos pendientes...');
  try {
    // 1. Sincronizar acciones de jornada
    const rawActions = await AsyncStorage.getItem(JOURNEY_ACTIONS_KEY);
    if (rawActions) {
      const actions = JSON.parse(rawActions);
      for (const action of actions) {
        try {
          await api.post(action.endpoint);
        } catch (e) {
          console.log(`Error sync action ${action.endpoint}:`, e.message);
        }
      }
      await AsyncStorage.removeItem(JOURNEY_ACTIONS_KEY);
    }

    // 2. Sincronizar fichas
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;

    const queue = JSON.parse(raw);
    if (queue.length === 0) return;

    console.log(`🔄 Sincronizando ${queue.length} fichas offline...`);
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
          timeout: 120000, // 2 minutos para subidas de fotos pesadas
        });

        console.log(`✅ Ficha ${item.id} sincronizada correctamente`);
      } catch (e) {
        const errorMsg = e.response?.data?.message || e.message;
        console.error(`❌ No se pudo sincronizar ficha ${item.id}:`, errorMsg);
        
        // GUARDAR LOG PARA EL USUARIO/SOPORTE
        await saveCrashLog(e, `SYNC_FICHA_${item.clienteId}`);
        
        remainingQueue.push(item);
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    if (remainingQueue.length === 0) {
      await logConnectionStatus('ONLINE');
    }
  } catch (err) {
    console.error('❌ Error en syncAllOfflineData:', err);
  } finally {
    isSyncing = false;
    console.log('🏁 Proceso de sincronización finalizado');
  }
};

export const getPendingClientIds = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    return queue.map(item => String(item.clienteId));
  } catch {
    return [];
  }
};
