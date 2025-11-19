const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../db");

router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;

    const [totalUsuarios, totalReservas, totalHabitaciones] = await Promise.all([
      pool.request().query("SELECT COUNT(*) AS total FROM Usuarios"),
      pool.request().query("SELECT COUNT(*) AS total FROM Reservas"),
      pool.request().query("SELECT COUNT(*) AS total FROM Habitaciones"),
    ]);

    res.json({
      success: true,
      usuarios: totalUsuarios.recordset[0].total,
      reservas: totalReservas.recordset[0].total,
      habitaciones: totalHabitaciones.recordset[0].total,
    });
  } catch (err) {
    console.error("❌ Error al obtener reportes:", err);
    res.status(500).json({ success: false, message: "Error al obtener reportes" });
  }
});

module.exports = router;
