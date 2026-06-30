import { useEffect, useState } from 'react';

/**
 * useAntiScraping - Hook de seguridad para el portal web
 * 
 * Este hook vigila el DOM en busca de nodos inyectados por extensiones (scrapers,
 * lectores automatizados, inyecciones de iframes/scripts de terceros).
 * Si detecta una intrusión, activa un estado global de ofuscación para proteger los datos en pantalla.
 */
export default function useAntiScraping() {
  const [isCompromised, setIsCompromised] = useState(false);

  useEffect(() => {
    // Si ya estamos comprometidos, no hace falta seguir observando
    if (isCompromised) return;

    const handleCompromised = (reason) => {
      console.warn(`[Seguridad] Entorno comprometido detectado: ${reason}`);
      setIsCompromised(true);
      // Aplicar clase al body para ofuscación global por CSS
      document.body.classList.add('obfuscate-mode');
    };

    // 1. Detección básica en el objeto window (ej. hooks de scraping global)
    if (window.__nightmare || window.callPhantom || window._phantom || window.__selenium_unwrapped || window.__webdriver_evaluate) {
      handleCompromised('Entorno automatizado detectado (Selenium/Phantom/Nightmare)');
      return;
    }

    // 2. MutationObserver para detectar scripts/nodos inyectados por extensiones
    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            // Revisar si es un elemento inyectado de Chrome/Firefox/Edge Extensions
            if (node.nodeType === Node.ELEMENT_NODE) {
              const src = node.getAttribute?.('src') || '';
              const href = node.getAttribute?.('href') || '';
              const id = node.getAttribute?.('id') || '';
              
              if (
                src.includes('chrome-extension://') || 
                src.includes('moz-extension://') ||
                href.includes('chrome-extension://') ||
                href.includes('moz-extension://') ||
                id.toLowerCase().includes('scraper') ||
                id.toLowerCase().includes('data-extractor') ||
                node.hasAttribute?.('data-extension') ||
                node.hasAttribute?.('data-extension-id')
              ) {
                // BLOQUEO ESTRICTO DE CUALQUIER EXTENSIÓN PARA OFUSCACIÓN DE DATOS
                handleCompromised('Extensión de navegador no autorizada inyectada');
                observer.disconnect();
              }
            }
          });
        }
      }
    });

    // Observar todo el documento (head y body)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // 3. Listener para detectar intentos agresivos de selección (Copy/Paste o SelectAll)
    let copyAttempts = 0;
    const handleCopy = (e) => {
      copyAttempts++;
      if (copyAttempts > 5) {
        // Bloquear si intenta copiar masivamente
        e.preventDefault();
        handleCompromised('Intentos múltiples de copia de datos detectados');
      }
    };
    
    document.addEventListener('copy', handleCopy);

    return () => {
      observer.disconnect();
      document.removeEventListener('copy', handleCopy);
    };
  }, [isCompromised]);

  return { isCompromised };
}
