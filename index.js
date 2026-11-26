const express = require("express");
const sql = require("mssql");
const app = express();
app.disable("x-powered-by");

// --- Seguridad: solo el proxy (edge function sap-proxy) puede llamar esta API ---
// La llave vive en la variable de entorno API_KEY de Render; nunca en el código.
const crypto = require("crypto");
function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) {
    // Falla cerrado: sin llave configurada no se sirve nada.
    console.error("API_KEY no configurada; solicitud rechazada");
    return res.status(503).json({ error: "service_unavailable" });
  }
  const given = req.get("x-api-key") || "";
  // Compara hashes de longitud fija para que el tiempo no revele la llave.
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}
// Ruta pública SOLO para el health check de Render (no devuelve datos).
// Va antes del candado; en Render: Settings -> Health Check Path = /healthz
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.use(requireApiKey);

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

// Configuración por centro: código de centro (WERKS) y sus almacenes (LGORT)
const CENTROS = {
  pal3: { werks: "PAL3", almacenes: ["P101", "P102", "P104", "P105", "P107"] },
  pal4: { werks: "PAL4", almacenes: ["P009", "P019", "P001", "PJC1"] }
};

// Reutilizamos la conexión (pool) en lugar de reconectar en cada request
const poolPromise = sql.connect(config);

async function getInventario(centro) {
  const pool = await poolPromise;
  const request = pool.request();

  // Parámetros para evitar SQL injection y mantener el query limpio
  request.input("werks", sql.VarChar, centro.werks);
  const placeholders = centro.almacenes.map((alm, i) => {
    request.input(`lgort${i}`, sql.VarChar, alm);
    return `@lgort${i}`;
  });

  const result = await request.query(`
    WITH UltimosInventarios AS (
        SELECT 
            MATNR, 
            WERKS, 
            LGORT, 
            LABST, 
            FechaDeCreacion,
            ROW_NUMBER() OVER(
                PARTITION BY MATNR, WERKS, LGORT 
                ORDER BY FechaDeCreacion DESC
            ) AS rn
        FROM Inventarios
        WHERE WERKS = @werks
          AND LGORT IN (${placeholders.join(", ")})
    )
    SELECT 
        MATNR, 
        WERKS, 
        SUM(LABST) AS LABST_Total, 
        MAX(FechaDeCreacion) AS UltimaActualizacion
    FROM UltimosInventarios
    WHERE rn = 1
    GROUP BY MATNR, WERKS;
  `);

  return result.recordset;
}

// Endpoint PAL3
app.get("/inventarios/pal3", async (req, res) => {
  try {
    const data = await getInventario(CENTROS.pal3);
    res.json(data);
  } catch (err) {
    console.error("Error en " + req.path + ":", err.message);
    res.status(500).json({ error: "internal_error" });
  }
});

// Endpoint PAL4
app.get("/inventarios/pal4", async (req, res) => {
  try {
    const data = await getInventario(CENTROS.pal4);
    res.json(data);
  } catch (err) {
    console.error("Error en " + req.path + ":", err.message);
    res.status(500).json({ error: "internal_error" });
  }
});

app.listen(3000, () => {
  console.log("API Inventarios corriendo en puerto 3000 con filtro de centro y última fecha");
});
