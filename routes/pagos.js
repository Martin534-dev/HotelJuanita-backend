const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../db");

// 💳 Registrar pago de una reserva
router.post("/", async (req, res) => {
  const { reservaId, metodoPago, montoPagado } = req.body;

  if (!reservaId || !metodoPago || !montoPagado) {
    return res.status(400).json({ success: false, message: "Faltan datos del pago." });
  }

  try {
    const pool = await poolPromise;

    // Verificar que la reserva exista
    const check = await pool
      .request()
      .input("reservaId", sql.Int, reservaId)
      .query("SELECT id, total, estado FROM Reservas WHERE id = @reservaId");

    if (check.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Reserva no encontrada." });
    }

    const reserva = check.recordset[0];

    // Evitar pagar una reserva ya pagada o cancelada
    if (["pagada", "cancelada"].includes(reserva.estado)) {
      return res.status(400).json({ success: false, message: "La reserva no se puede pagar." });
    }

    // Registrar el pago y actualizar la reserva
    await pool
      .request()
      .input("reservaId", sql.Int, reservaId)
      .input("metodoPago", sql.NVarChar(50), metodoPago)
      .input("montoPagado", sql.Decimal(10, 2), montoPagado)
      .query(`
        UPDATE Reservas
        SET metodoPago = @metodoPago,
            montoPagado = @montoPagado,
            estado = 'pagada'
        WHERE id = @reservaId
      `);

    res.json({
      success: true,
      message: "✅ Pago registrado correctamente.",
      pago: { reservaId, metodoPago, montoPagado },
    });
  } catch (err) {
    console.error("❌ Error en POST /pagos:", err);
    res.status(500).json({ success: false, message: "Error al registrar el pago." });
  }
});

module.exports = router;
