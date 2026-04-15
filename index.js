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
                  WHEN BWART IN (302, 301) THEN ABS(Cantidad)
                  WHEN BWART IN (301, 302) THEN -ABS(Cantidad)
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
    res.status(500).json({ error: err.toString() });
  }
});
