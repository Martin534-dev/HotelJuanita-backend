const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../db");

// =======================================================
// CREAR RESERVA (verifica estado, fechas y superposición)
// =======================================================
router.post("/", async (req, res) => {
  const {
    nombre,
    correo,
    email,
    habitacion,
    habitacionId,
    fechaEntrada,
    fechaSalida,
    personas,
    precioNoche,
    total,
    metodoPago,
  } = req.body;

  const correoFinal = correo || email;

  if (
    !nombre ||
    !correoFinal ||
    !habitacion ||
    !habitacionId ||
    !fechaEntrada ||
    !fechaSalida ||
    !precioNoche ||
    !metodoPago
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Faltan datos para registrar la reserva." });
  }

  try {
    const pool = await poolPromise;

    // 🔹 1. Verificar que la habitación exista y esté disponible
    const habCheck = await pool
      .request()
      .input("id", sql.Int, habitacionId)
      .query("SELECT tipo, estado FROM Habitaciones WHERE id = @id");

    if (habCheck.recordset.length === 0) {
      return res.json({
        success: false,
        message: "La habitación seleccionada no existe.",
      });
    }

    const { tipo: tipoHab, estado: estadoHab } = habCheck.recordset[0];

    if ((estadoHab || "").toLowerCase() !== "disponible") {
      return res.json({
        success: false,
        message: `La habitación '${tipoHab}' está actualmente ${estadoHab}. No se puede reservar.`,
      });
    }

    // 🔹 2. Validar rango temporal correcto
    const hoy = new Date();
    const ingreso = new Date(fechaEntrada);
    const salida = new Date(fechaSalida);

    hoy.setHours(0, 0, 0, 0);
    ingreso.setHours(0, 0, 0, 0);
    salida.setHours(0, 0, 0, 0);

    if (ingreso < hoy) {
      return res.json({
        success: false,
        message: "⚠️ La fecha de ingreso no puede ser anterior al día actual.",
      });
    }

    if (salida <= ingreso) {
      return res.json({
        success: false,
        message: "⚠️ La fecha de salida debe ser posterior a la de ingreso.",
      });
    }

    // 🔹 3. Verificar superposición de fechas (solo en la misma habitación real)
    const conflicto = await pool
      .request()
      .input("habitacionId", sql.Int, habitacionId)
      .input("fechaEntrada", sql.Date, fechaEntrada)
      .input("fechaSalida", sql.Date, fechaSalida)
      .query(`
        SELECT id FROM Reservas
        WHERE estado IN ('pendiente', 'pagada')
          AND habitacionId = @habitacionId
          AND (
            fechaEntrada < @fechaSalida
            AND fechaSalida > @fechaEntrada
          )
      `);

    // 🔹 4. Compatibilidad con reservas viejas (sin habitacionId)
    if (conflicto.recordset.length === 0) {
      const conflictoViejo = await pool
        .request()
        .input("habitacionTipo", sql.NVarChar(50), habitacion)
        .input("fechaEntrada", sql.Date, fechaEntrada)
        .input("fechaSalida", sql.Date, fechaSalida)
        .query(`
          SELECT id FROM Reservas
          WHERE estado IN ('pendiente', 'pagada')
            AND habitacionId IS NULL
            AND LOWER(LTRIM(RTRIM(habitacion))) = LOWER(LTRIM(RTRIM(@habitacionTipo)))
            AND (
              fechaEntrada < @fechaSalida
              AND fechaSalida > @fechaEntrada
            )
        `);

      if (conflictoViejo.recordset.length > 0) {
        return res.json({
          success: false,
          message:
            "⚠️ Ya existe una reserva activa de este tipo en esas fechas. (reserva anterior sin ID).",
        });
      }
    } else {
      // Hay conflicto real por ID
      return res.json({
        success: false,
        message:
          "⚠️ Ya existe una reserva activa en esas fechas para esta habitación.",
      });
    }

    // 🔹 5. Insertar la reserva
    await pool
      .request()
      .input("nombre", sql.NVarChar(100), nombre)
      .input("correo", sql.NVarChar(100), correoFinal)
      .input("habitacion", sql.NVarChar(50), habitacion)
      .input("habitacionId", sql.Int, habitacionId)
      .input("fechaEntrada", sql.Date, fechaEntrada)
      .input("fechaSalida", sql.Date, fechaSalida)
      .input("personas", sql.Int, personas || 1)
      .input("precioNoche", sql.Decimal(10, 2), precioNoche)
      .input("total", sql.Decimal(10, 2), total || precioNoche)
      .input("metodoPago", sql.NVarChar(50), metodoPago)
      .query(`
        INSERT INTO Reservas
        (nombre, correo, habitacion, habitacionId, fechaEntrada, fechaSalida, personas, precioNoche, total, metodoPago, estado)
        VALUES
        (@nombre, @correo, @habitacion, @habitacionId, @fechaEntrada, @fechaSalida, @personas, @precioNoche, @total, @metodoPago, 'pendiente')
      `);

    // 🔹 6. Éxito
    return res.json({
      success: true,
      message: "✅ Reserva creada correctamente.",
    });
  } catch (err) {
    console.error("Error POST /reservas:", err);
    return res.status(500).json({
      success: false,
      message: "Error interno al crear la reserva.",
    });
  }
});

// =======================================================
// PENDIENTES (OPERADOR)
// =======================================================
router.get("/pending", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT * FROM Reservas
      WHERE LOWER(LTRIM(RTRIM(estado))) = 'pendiente'
      ORDER BY id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error GET /reservas/pending:", err);
    res.status(500).send("Error al obtener reservas pendientes");
  }
});

// =======================================================
// TODAS
// =======================================================
router.get("/", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Reservas ORDER BY id DESC");
    res.json({ success: true, items: result.recordset });
  } catch (err) {
    console.error("Error GET /reservas:", err);
    res.status(500).json({ success: false, message: "Error al obtener reservas" });
  }
});

// =======================================================
// MÍAS (por correo)
// =======================================================
router.get("/mine", async (req, res) => {
  const correoFinal = req.query.correo || req.query.email;
  if (!correoFinal) return res.status(400).send("Falta correo/email");

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("correo", sql.NVarChar(100), correoFinal)
      .query("SELECT * FROM Reservas WHERE correo=@correo ORDER BY id DESC");

    res.json(result.recordset);
  } catch (err) {
    console.error("Error GET /reservas/mine:", err);
    res.status(500).send("Error al obtener reservas del usuario");
  }
});

// =======================================================
// ACTUALIZAR ESTADO (confirm/cancel)
// =======================================================
router.put("/:id/:action", async (req, res) => {
  const { id, action } = req.params;
  const valid = ["confirm", "cancel"];
  if (!valid.includes(action)) {
    return res.status(400).json({ success: false, message: "Acción inválida" });
  }
  const nuevoEstado = action === "confirm" ? "pagada" : "cancelada";

  try {
    const pool = await poolPromise;
    await pool.request().input("id", sql.Int, id)
      .query(`UPDATE Reservas SET estado='${nuevoEstado}' WHERE id=@id`);

    res.json({ success: true, message: `Reserva #${id} actualizada a "${nuevoEstado}"` });
  } catch (err) {
    console.error("Error PUT /reservas/:id/:action:", err);
    res.status(500).json({ success: false, message: "Error al actualizar estado" });
  }
});

// =======================================================
// BUSCAR (estado/fechas)
// =======================================================
router.get("/search", async (req, res) => {
  const { estado, desde, hasta } = req.query;
  try {
    const pool = await poolPromise;
    let query = "SELECT * FROM Reservas WHERE 1=1";
    if (estado) query += ` AND LOWER(LTRIM(RTRIM(estado))) = LOWER('${estado}')`;
    if (desde)  query += ` AND fechaEntrada >= '${desde}'`;
    if (hasta)  query += ` AND fechaSalida <= '${hasta}'`;
    query += " ORDER BY id DESC";
    const result = await pool.request().query(query);
    res.json({ success: true, items: result.recordset });
  } catch (err) {
    console.error("Error GET /reservas/search:", err);
    res.status(500).json({ success: false, message: "Error al filtrar reservas" });
  }
});

// =======================================================
// ELIMINAR
// =======================================================
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("id", sql.Int, id)
      .query("DELETE FROM Reservas WHERE id = @id");

    if (result.rowsAffected[0] > 0) {
      res.json({ success: true, message: `Reserva #${id} eliminada correctamente` });
    } else {
      res.status(404).json({ success: false, message: "Reserva no encontrada" });
    }
  } catch (err) {
    console.error("Error DELETE /reservas/:id:", err);
    res.status(500).json({ success: false, message: "Error al eliminar la reserva" });
  }
});

module.exports = router;
