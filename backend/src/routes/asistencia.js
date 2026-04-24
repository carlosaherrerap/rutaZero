const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');

const router = Router();
router.use(authMiddleware, adminOnly);

// ─── ASISTENCIA ─────────────────────────────────────────────────────────────

/**
 * GET /api/asistencia
 * Lista jornadas de todos los workers con métricas calculadas (admin)
 * Params: fecha (YYYY-MM-DD), worker_id
 */
router.get('/', async (req, res) => {
  try {
    const { fecha, worker_id, mes, anio } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    let p = 1;

    if (fecha) { where += ` AND j.fecha = $${p++}`; params.push(fecha); }
    if (worker_id) { where += ` AND j.worker_id = $${p++}`; params.push(worker_id); }
    if (mes && anio) {
      where += ` AND EXTRACT(MONTH FROM j.fecha) = $${p++} AND EXTRACT(YEAR FROM j.fecha) = $${p++}`;
      params.push(mes, anio);
    }

    const { rows } = await db.query(`
      SELECT
        j.id, j.fecha, j.estado, j.validado, j.validado_at,
        j.hora_inicio_sesion, j.hora_inicio_almuerzo, j.hora_fin_almuerzo, j.hora_fin_jornada,
        u.nombres, u.apellidos, u.id AS worker_id,
        -- Duración refrigerio en minutos
        CASE 
          WHEN j.hora_inicio_almuerzo IS NOT NULL AND j.hora_fin_almuerzo IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (j.hora_fin_almuerzo - j.hora_inicio_almuerzo)) / 60)
          ELSE 0
        END AS duracion_refrigerio_min,
        -- Horas trabajadas
        CASE
          WHEN j.hora_inicio_sesion IS NOT NULL AND j.hora_fin_jornada IS NOT NULL
          THEN ROUND(
            (EXTRACT(EPOCH FROM (j.hora_fin_jornada - j.hora_inicio_sesion)) / 3600 -
             COALESCE(EXTRACT(EPOCH FROM (j.hora_fin_almuerzo - j.hora_inicio_almuerzo)) / 3600, 0))::numeric,
          2)
          ELSE NULL
        END AS horas_trabajadas,
        -- Clientes gestionados ese día
        (
          SELECT COUNT(*) FROM gestiones_historial gh
          WHERE gh.worker_id = j.worker_id
            AND DATE(gh.created_at AT TIME ZONE 'America/Lima') = j.fecha
        ) AS clientes_gestionados,
        -- Rutas asignadas ese día
        (
          SELECT COUNT(*) FROM rutas r
          WHERE r.worker_id = j.worker_id AND r.fecha_asignacion = j.fecha
        ) AS rutas_asignadas
      FROM jornadas j
      JOIN usuarios u ON u.id = j.worker_id
      ${where}
      ORDER BY j.fecha DESC, u.apellidos
    `, params);

    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener asistencia:', err);
    res.status(500).json({ error: 'Error al obtener asistencia' });
  }
});

/**
 * PATCH /api/asistencia/:jornadaId/validar
 * Admin valida el día → aparece verde en el calendario del worker
 */
router.patch('/:jornadaId/validar', async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE jornadas
      SET validado = TRUE, validado_por = $1, validado_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [req.user.id, req.params.jornadaId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Jornada no encontrada' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al validar jornada:', err);
    res.status(500).json({ error: 'Error al validar jornada' });
  }
});

// ─── CICLOS ─────────────────────────────────────────────────────────────────

/**
 * GET /api/asistencia/ciclos
 * Lista todos los clientes gestionados (estados terminales)
 */
router.get('/ciclos', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.id, c.nombres, c.apellidos, c.dni, c.telefono, c.estado,
             c.deuda_total, c.dias_retraso, c.fecha_pago,
             ub.direccion, ub.distrito,
             u.nombres || ' ' || u.apellidos AS ultimo_worker,
             gh.created_at AS fecha_gestion, gh.tipificacion
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      LEFT JOIN LATERAL (
        SELECT worker_id, created_at, tipificacion FROM gestiones_historial
        WHERE cliente_id = c.id ORDER BY created_at DESC LIMIT 1
      ) gh ON true
      LEFT JOIN usuarios u ON u.id = gh.worker_id
      WHERE c.estado IN ('VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO')
      ORDER BY gh.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener ciclos:', err);
    res.status(500).json({ error: 'Error al obtener ciclos' });
  }
});

/**
 * PATCH /api/asistencia/ciclos/:clienteId/liberar
 * Libera un cliente: cambia estado a LIBRE y actualiza fecha_pago
 */
router.patch('/ciclos/:clienteId/liberar', async (req, res) => {
  try {
    const { fecha_pago } = req.body;
    if (!fecha_pago) return res.status(400).json({ error: 'fecha_pago es requerida' });

    const { rows } = await db.query(`
      UPDATE clientes
      SET estado = 'LIBRE', bloqueado_por = NULL, fecha_pago = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, nombres, apellidos, estado, fecha_pago
    `, [fecha_pago, req.params.clienteId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al liberar cliente en ciclos:', err);
    res.status(500).json({ error: 'Error al liberar cliente' });
  }
});

// ─── EXCEL IMPORT ────────────────────────────────────────────────────────────

const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * POST /api/asistencia/ciclos/importar-excel
 * Recibe un Excel con columnas DOCUMENTO y FECHA_PAGO
 * Actualiza la fecha_pago del cliente cuyo dni = DOCUMENTO
 */
router.post('/ciclos/importar-excel', uploadExcel.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo Excel' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) return res.status(400).json({ error: 'El archivo Excel está vacío' });

    let actualizados = 0;
    let errores = [];

    for (const row of rows) {
      const documento = String(row.DOCUMENTO || '').trim();
      let fechaPago = row.FECHA_PAGO;

      if (!documento || !fechaPago) {
        errores.push(`Fila sin DOCUMENTO o FECHA_PAGO: ${JSON.stringify(row)}`);
        continue;
      }

      // Si FECHA_PAGO viene como número serial de Excel, convertir
      if (typeof fechaPago === 'number') {
        const date = XLSX.SSF.parse_date_code(fechaPago);
        fechaPago = `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
      } else {
        // Formato DD/MM/YYYY → YYYY-MM-DD
        const parts = String(fechaPago).split('/');
        if (parts.length === 3) {
          fechaPago = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }

      const result = await db.query(
        `UPDATE clientes SET fecha_pago = $1, estado = 'LIBRE', bloqueado_por = NULL, updated_at = NOW()
         WHERE dni = $2 RETURNING id`,
        [fechaPago, documento]
      );

      if (result.rows.length > 0) actualizados++;
      else errores.push(`DNI no encontrado: ${documento}`);
    }

    res.json({ message: `${actualizados} clientes actualizados`, errores });
  } catch (err) {
    console.error('Error al importar Excel:', err);
    res.status(500).json({ error: 'Error al procesar el archivo Excel' });
  }
});

module.exports = router;
