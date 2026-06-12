import { Alert, BackHandler, Platform } from 'react-native';
import Constants from 'expo-constants';

let JailMonkey;
try {
  // Solo intentamos importar el código nativo si NO estamos en Expo Go
  if (Constants.appOwnership !== 'expo') {
    JailMonkey = require('jail-monkey').default || require('jail-monkey');
  } else {
    console.warn('⚠️ [Seguridad] Ejecutando en Expo Go: Bypass de chequeos nativos.');
  }
} catch (e) {
  console.warn('⚠️ [Seguridad] JailMonkey no está compilado correctamente.');
}

export const SecurityService = {
  /**
   * Ejecuta comprobaciones de seguridad estrictas (Jailbreak, Root, Mock Locations).
   * Si se detecta una amenaza, advierte al usuario y cierra la app.
   */
  runStrictSecurityChecks: () => {
    // Si la librería no pudo cargar (porque estamos en Expo Go), omitimos la validación.
    if (!JailMonkey || typeof JailMonkey.isJailBroken !== 'function') {
      console.warn('⚠️ [Seguridad] Bypass de chequeos Root/Jailbreak por entorno Expo Go.');
      return true;
    }

    // 1. Detección de Jailbreak / Root
    if (JailMonkey.isJailBroken()) {
      SecurityService.handleThreat('Dispositivo Comprometido', 'Se ha detectado Root o Jailbreak en este dispositivo. Por políticas de seguridad, la aplicación no puede ejecutarse.');
      return false;
    }

    // 2. Detección de Hooks / Entorno Inseguro (ej. Frida, Xposed)
    if (JailMonkey.hookDetected()) {
      SecurityService.handleThreat('Entorno Inseguro', 'Se ha detectado software de manipulación (Hooks). La aplicación se cerrará.');
      return false;
    }

    // 3. Detección de Mock Locations (Ubicación Falsa)
    // Ojo: En Android puede requerir permisos adicionales si se chequea agresivamente,
    // pero JailMonkey proporciona un check básico.
    if (JailMonkey.canMockLocation()) {
      SecurityService.handleThreat('Ubicación Falsa Detectada', 'Por favor desactiva la simulación de ubicación (Mock Locations) para usar la app.');
      return false;
    }

    // 4. Detección de Emuladores (Opcional, pero recomendado en entornos ultra-seguros)
    // Descomentar si se desea bloquear emuladores en producción
    /*
    if (JailMonkey.isExternalStorage() || __DEV__ === false) {
       // Opcionalmente agregar verificaciones de emulador nativo si se instala react-native-device-info
    }
    */

    return true; // Dispositivo seguro
  },

  handleThreat: (title, message) => {
    console.error(`[SECURITY THREAT DETECTED]: ${title} - ${message}`);
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cerrar App',
          onPress: () => {
            if (Platform.OS === 'android') {
              BackHandler.exitApp();
            } else {
              // En iOS no hay una forma "legal" de hacer exitApp, pero podemos forzar un throw o dejar en pantalla de bloqueo
              throw new Error('Security Threat: App Terminada');
            }
          }
        }
      ],
      { cancelable: false }
    );
  }
};
