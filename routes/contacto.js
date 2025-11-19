const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

// ===============================
// Configuración del transporte SMTP
// ===============================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ===============================
// Ruta 1: Envío estándar (usada por Operador.jsx)
// ===============================
router.post("/", async (req, res) => {
  const { correo, asunto, mensaje } = req.body;
  if (!correo || !asunto || !mensaje) {
    return res
      .status(400)
      .json({ success: false, message: "Datos de correo incompletos" });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: correo,
      subject: asunto,
      html: mensaje,
    });
    res.json({ success: true, message: "📧 Respuesta enviada correctamente" });
  } catch (err) {
    console.error("Error enviando correo:", err);
    res
      .status(500)
      .json({ success: false, message: "No se pudo enviar el correo" });
  }
});

// ===============================
// Ruta 2: Alternativa /responder
// ===============================
router.post("/responder", async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res
      .status(400)
      .json({ success: false, message: "Datos de email incompletos" });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    res.json({ success: true, message: "📧 Respuesta enviada" });
  } catch (e) {
    console.error("contacto/responder", e);
    res
      .status(500)
      .json({ success: false, message: "No se pudo enviar el correo" });
  }
});

module.exports = router;
