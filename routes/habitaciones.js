const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../db");

// =======================================================
// OBTENER TODAS LAS HABITACIONES
// =======================================================
router.get("/", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        id, 
        tipo, 
        numero, 
        precio, 
        ISNULL(capacidad, 1) AS capacidad,
        estado, 
        ISNULL(descripcion, '') AS descripcion,
        ISNULL(imagen, '') AS imagen
      FROM Habitaciones
      ORDER BY id ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error GET /habitaciones:", err);
    res.status(500).send("Error al obtener habitaciones");
  }
});

// =======================================================
// CREAR NUEVA HABITACIÓN
// =======================================================
router.post("/", async (req, res) => {
  try {
    const { numero, tipo, precio, capacidad, estado, descripcion, imagen } = req.body;

    if (!numero || !tipo || precio === undefined || !estado) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan datos obligatorios" });
    }

    const pool = await poolPromise;
    await pool
      .request()
      .input("numero", sql.NVarChar(10), String(numero))
      .input("tipo", sql.NVarChar(100), tipo)
      .input("precio", sql.Decimal(10, 2), precio)
      .input("capacidad", sql.Int, capacidad || 1)
      .input("estado", sql.NVarChar(50), estado)
      .input("descripcion", sql.NVarChar(sql.MAX), descripcion || "")
      .input("imagen", sql.NVarChar(sql.MAX), imagen || "")
      .query(`
        INSERT INTO Habitaciones (numero, tipo, precio, capacidad, estado, descripcion, imagen)
        VALUES (@numero, @tipo, @precio, @capacidad, @estado, @descripcion, @imagen)
      `);

    res.json({ success: true, message: "Habitación agregada correctamente" });
  } catch (err) {
    console.error("Error POST /habitaciones:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al agregar habitación" });
  }
});

// =======================================================
// ACTUALIZAR HABITACIÓN COMPLETA
// =======================================================
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { tipo, precio, capacidad, estado, descripcion, imagen } = req.body;

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("tipo", sql.NVarChar(100), tipo)
      .input("precio", sql.Decimal(10, 2), precio)
      .input("capacidad", sql.Int, capacidad || 1)
      .input("estado", sql.NVarChar(50), estado)
      .input("descripcion", sql.NVarChar(sql.MAX), descripcion || "")
      .input("imagen", sql.NVarChar(sql.MAX), imagen || "")
      .query(`
        UPDATE Habitaciones
        SET tipo=@tipo, precio=@precio, capacidad=@capacidad, estado=@estado, descripcion=@descripcion, imagen=@imagen
        WHERE id=@id
      `);

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Habitación no encontrada" });
    }

    res.json({ success: true, message: "Habitación actualizada correctamente" });
  } catch (err) {
    console.error("Error PUT /habitaciones/:id:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar habitación" });
  }
});

// =======================================================
// ACTUALIZAR SOLO EL ESTADO (para el Mapa de Habitaciones)
// =======================================================
router.put("/:id/estado", async (req, res) => {
  try {
    const { estado } = req.body;
    const id = Number(req.params.id);

    if (!estado) {
      return res
        .status(400)
        .json({ success: false, message: "Falta el estado a actualizar" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("estado", sql.NVarChar(50), estado)
      .query("UPDATE Habitaciones SET estado = @estado WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Habitación no encontrada" });
    }

    res.json({
      success: true,
      message: `Estado de habitación #${id} actualizado a "${estado}"`,
    });
  } catch (err) {
    console.error("Error PUT /habitaciones/:id/estado:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar estado" });
  }
});

// =======================================================
// ELIMINAR HABITACIÓN
// =======================================================
router.delete("/:id", async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, Number(req.params.id))
      .query("DELETE FROM Habitaciones WHERE id = @id");

    res.json({ success: true, message: "Habitación eliminada correctamente" });
  } catch (err) {
    console.error("Error DELETE /habitaciones/:id:", err);
    res.status(500).send("Error al eliminar habitación");
  }
});

module.exports = router;
