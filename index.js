// 1. Importaciones necesarias
const express = require('express');
const sql = require('mssql'); // Asumiendo que usas mssql

// 2. Inicialización de la aplicación
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Configuración de tu base de datos (¡Ojo! En producción usa variables de entorno)
const config = {
    user: process.env.DB_USER || 'tu_usuario',
    password: process.env.DB_PASSWORD || 'tu_password',
    server: process.env.DB_SERVER || 'tu_servidor', 
    database: process.env.DB_NAME || 'tu_base_de_datos',
    options: {
        encrypt: true, 
        trustServerCertificate: true // Importante dependiendo de tu tipo de servidor SQL
    }
};

// 4. TU RUTA (Aquí va el código que me compartiste)
app.get("/consumo/pal4", async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT 
          MATNR,
          WERKS,
          LGORT,
          SUM(
              CASE 
                  -- REVISIÓN IMPORTANTE EN ESTA PARTE:
                  WHEN BWART = 301 THEN ABS(MENGE)
                  WHEN BWART = 302 THEN -ABS(MENGE)
                  ELSE 0
              END
          ) AS ConsumoUltimos3Meses,
          MAX(BUDAT_MKPF) AS UltimaFecha
      FROM MovimientosDeInventario
      WHERE LGORT IN ('P009', 'P019', 'P001')
        AND BUDAT_MKPF >= DATEADD(MONTH, -3, GETDATE())
        AND BWART IN (301,302)
      GROUP BY MATNR, WERKS, LGORT;
    `);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(result.recordset);
  } catch (err) {
    console.error("Error en la ruta:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// 5. Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
