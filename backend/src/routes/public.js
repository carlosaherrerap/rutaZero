const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// Configuración de Multer para fotos de registro (S3/R2 o Local)
let upload;

if (process.env.S3_BUCKET) {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `registros/reg-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      }
    }),
    limits: { fileSize: 15 * 1024 * 1024 }
  });
} else {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = 'uploads/registros';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `reg-${Date.now()}-${file.originalname}`);
    }
  });
  upload = multer({ storage });
}

router.get('/ping', (req, res) => res.json({ message: 'pong' }));

/**
 * POST /api/public/registro-cliente
 */
router.post('/registro-cliente', upload.array('fotos', 5), async (req, res) => {
  console.log('📥 Solicitud recibida: /registro-cliente');
  try {
    const { 
      nombres, apellidos, tipo_documento, numero_documento,
      departamento, provincia, distrito, direccion, referencia,
      latitud, longitud, telefono, email, nombre_comercial
    } = req.body;

    const publicBase = process.env.S3_PUBLIC_URL;
    const fotos_urls = req.files.map(f => {
      if (publicBase) {
        return `${publicBase.endsWith('/') ? publicBase : publicBase + '/'}${f.key || f.filename}`;
      }
      return f.location || `/uploads/registros/${f.filename}`;
    });

    // 1. Crear ubicación
    const ubRes = await db.query(
      'INSERT INTO ubicaciones (latitud, longitud, direccion, distrito, departamento, provincia) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [
        parseFloat(latitud) || 0, 
        parseFloat(longitud) || 0, 
        direccion || '', 
        distrito || '',
        departamento || '',
        provincia || ''
      ]
    );
    const ubicacion_id = ubRes.rows[0].id;

    // Determinar sede_id basado en departamento
    let sede_id = '11111111-1111-1111-1111-000000000001'; // Default Lima
    if (departamento && departamento.toUpperCase() === 'AREQUIPA') {
      sede_id = '11111111-1111-1111-1111-000000000002';
    }

    // 2. Crear cliente
    const clientRes = await db.query(
      `INSERT INTO clientes (
        nombres, apellidos, tipo_documento, dni, 
        departamento, provincia, distrito, direccion, referencia,
        ubicacion_id, fotos_registro, estado, telefono, email, nombre_comercial, 
        sede_id, fecha_pago
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_DATE) RETURNING id`,
      [
        nombres || '', 
        apellidos || '', 
        tipo_documento || 'DNI', 
        numero_documento || '',
        departamento || '', 
        provincia || '', 
        distrito || '', 
        direccion || '', 
        referencia || '',
        ubicacion_id, 
        JSON.stringify(fotos_urls || []), 
        'LIBRE',
        telefono || '',
        email || '',
        nombre_comercial || '',
        sede_id
      ]
    );
    console.log('✅ Cliente registrado ID:', clientRes.rows[0].id);

    res.json({ success: true, message: 'Cliente registrado con éxito', id: clientRes.rows[0].id });
  } catch (err) {
    console.error('❌ Error crítico en registro público cliente:', err);
    
    let errorDetail = err.message;
    if (err.code === '23505') {
      errorDetail = 'El número de documento ya se encuentra registrado.';
    }

    res.status(500).json({ 
      success: false,
      error: 'Error al procesar el registro', 
      details: errorDetail,
      code: err.code
    });
  }
});

/**
 * POST /api/public/registro-worker
 */
router.post('/registro-worker', upload.none(), async (req, res) => {
  console.log('📥 Solicitud recibida: /registro-worker');
  try {
    const { 
      nombres, apellidos, tipo_documento, numero_documento,
      departamento, provincia, distrito, direccion, referencia,
      latitud, longitud, username, password, telefono, email
    } = req.body;

    console.log('🔑 Generando hash de contraseña...');
    const password_hash = await bcrypt.hash(password || 'worker123', 10);
    console.log('✅ Hash generado');

    console.log('📍 Creando ubicación para worker...');
    const ubRes = await db.query(
      'INSERT INTO ubicaciones (latitud, longitud, direccion, distrito, departamento, provincia) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [
        parseFloat(latitud) || 0, 
        parseFloat(longitud) || 0, 
        direccion || '', 
        distrito || '',
        departamento || '',
        provincia || ''
      ]
    );
    const ubicacion_id = ubRes.rows[0].id;
    console.log('✅ Ubicación creada ID:', ubicacion_id);

    console.log('👤 Creando usuario worker en DB...');
    const userRes = await db.query(
      `INSERT INTO usuarios (
        nombres, apellidos, username, password_hash, rol, 
        tipo_documento, dni, departamento, provincia, distrito, 
        direccion, referencia, ubicacion_id, estado, telefono, email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
      [
        String(nombres || '').trim(), 
        String(apellidos || '').trim(), 
        String(username || numero_documento || '').trim(), 
        password_hash, 
        'WORKER',
        String(tipo_documento || 'DNI').trim(), 
        String(numero_documento || '').trim(), 
        String(departamento || '').trim(), 
        String(provincia || '').trim(), 
        String(distrito || '').trim(),
        String(direccion || '').trim(), 
        String(referencia || '').trim(), 
        ubicacion_id, 
        'ACTIVO',
        String(telefono || '').trim(),
        String(email || '').trim()
      ]
    );
    console.log('✅ Worker creado con éxito. ID:', userRes.rows[0].id);

    res.json({ success: true, message: 'Worker registrado con éxito', id: userRes.rows[0].id });
  } catch (err) {
    console.error('❌ Error crítico en registro público worker:', err);
    
    // Manejo específico de errores de base de datos
    let errorDetail = err.message;
    if (err.code === '23505') {
      errorDetail = 'El nombre de usuario o número de documento ya se encuentra registrado.';
    }

    res.status(500).json({ 
      success: false,
      error: 'Error al procesar el registro', 
      details: errorDetail,
      code: err.code
    });
  }
});

module.exports = router;
