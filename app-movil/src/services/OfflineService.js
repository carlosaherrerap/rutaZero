/**
 * OfflineService.js
 * Guarda gestiones localmente con AsyncStorage cuando no hay internet.
 * Las fotos se guardan por referencia de URI (sin copiar archivos).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'rz_pending_fichas';

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
 * Limpia TODA la cola offline (útil al reiniciar la app)
 */
export const clearOfflineCache = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
  console.log('🧹 Caché offline limpiada');
};

/**
 * Guarda una ficha en la cola local cuando el servidor no está disponible.
 * @param {string} clienteId - UUID del cliente
 * @param {object} formData  - Datos del formulario
 * @param {string[]} fotos   - Array de URIs de las fotos (no se copian, se referencian)
 */
export const saveFichaOffline = async (clienteId, formData, fotos) => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];

    queue.push({
      id: Date.now().toString(),
      clienteId,
      formData,
      fotos,          // URIs del teléfono - válidos hasta que el OS los limpie
      savedAt: new Date().toISOString()
    });

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`📦 Ficha guardada offline. Total en cola: ${queue.length}`);
    return true;
  } catch (err) {
    console.error('Error guardando offline:', err);
    return false;
  }
};

/**
 * Sincroniza las fichas pendientes cuando hay internet.
 * @param {AxiosInstance} api - Instancia de axios del contexto
 */
export const syncPendingFichas = async (api) => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  try {
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

        // Adjuntar fotos (si los URIs todavía son válidos)
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
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        console.log(`✅ Ficha ${item.id} sincronizada correctamente`);
        // No la añadimos a remainingQueue → queda eliminada
      } catch (e) {
        console.error(`❌ No se pudo sincronizar ficha ${item.id}:`, e.message);
        remainingQueue.push(item); // Reintentar después
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));

    if (remainingQueue.length === 0) {
      console.log('🎉 Todas las fichas offline sincronizadas');
    } else {
      console.log(`⏳ ${remainingQueue.length} fichas pendientes para el próximo intento`);
    }
  } catch (err) {
    console.error('Error en syncPendingFichas:', err);
  }
};

/**
 * Devuelve cuántas fichas hay pendientes de sincronizar
 */
export const getPendingCount = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw).length : 0;
  } catch {
    return 0;
  }
};
