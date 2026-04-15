const express = require("express");
const sql = require("mssql");
const app = express();

// Configuración desde variables de ambiente
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Endpoint para leer MovimientosDeInventario PAL3 (últimos 3 meses)
app.get("/consumo/pal3", async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      WITH ConsumoUltimos3Meses AS (
          SELECT 
              MATNR, 
              WERKS, 
              LGORT, 
              BWART,  -- Tipo de movimiento
              BUDAT_MKPF,  -- Fecha de contabilización
              MENGE,
              SUM(CASE 
                  WHEN BWART IN (301, 302) THEN ABS(Cantidad)  -- Movimientos de consumo (301 y 302)
                  ELSE 0 
              END) AS ConsumoTotal, 
              ROW_NUMBER() OVER(PARTITION BY MATNR, LGORT ORDER BY BUDAT_MKPF DESC) as rn
          FROM MovimientosDeInventario
          WHERE LGORT IN ('P101', 'P102', 'P103','P104','P105','P107')
            AND BUDAT_MKPF >= DATEADD(MONTH, -3, GETDATE())  -- Filtro para los últimos 3 meses
          GROUP BY MATNR, WERKS, LGORT, BWART, BUDAT_MKPF
      )
      SELECT 
          MATNR, 
          WERKS, 
          LGORT, 
          SUM(ConsumoTotal) AS ConsumoUltimos3Meses, 
          MAX(BUDAT_MKPF) AS UltimaFechaContabilizacion
      FROM ConsumoUltimos3Meses
      WHERE rn = 1
      GROUP BY MATNR, WERKS, LGORT;
    `);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// Endpoint para leer Consumo de Inventarios PAL4 (últimos 3 meses)
app.get("/consumo/pal4", async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      WITH ConsumoUltimos3Meses AS (
          SELECT 
              MATNR, 
              WERKS, 
              LGORT, 
              BWART,  -- Tipo de movimiento
              BUDAT_MKPF,  -- Fecha de contabilización
              SUM(CASE 
                  WHEN BWART IN (301, 302) THEN ABS(MENGE)  -- Movimientos de consumo (301 y 201)
                  ELSE 0 
              END) AS ConsumoTotal, 
              ROW_NUMBER() OVER(PARTITION BY MATNR, LGORT ORDER BY BUDAT_MKPF DESC) as rn
          FROM MovimientosDeInventario
          WHERE LGORT IN ('P009', 'P019', 'P001')
            AND BUDAT_MKPF >= DATEADD(MONTH, -3, GETDATE())  -- Filtro para los últimos 3 meses
          GROUP BY MATNR, WERKS, LGORT, BWART, BUDAT_MKPF
      )
      SELECT 
          MATNR, 
          WERKS, 
          LGORT, 
          SUM(ConsumoTotal) AS ConsumoUltimos3Meses, 
          MAX(BUDAT_MKPF) AS UltimaFechaContabilizacion
      FROM ConsumoUltimos3Meses
      WHERE rn = 1
      GROUP BY MATNR, WERKS, LGORT;
    `);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(3000, () => {
  console.log("API MovimientosDeInventario corriendo en puerto 3000 con filtro de últimos 3 meses");
});
