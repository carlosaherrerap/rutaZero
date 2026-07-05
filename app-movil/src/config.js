// export const BASE_URL = 'http://192.168.18.27:4000'; // Local
export const BASE_URL = 'https://rutazero-backend-cgtl.onrender.com'; // Render (Producción)

export const API_URL = `${BASE_URL}/api`;

export const MODELO_NEGOCIO = process.env.EXPO_PUBLIC_MODELO_NEGOCIO || process.env.MODELO_NEGOCIO || 'AFAACOOP';
