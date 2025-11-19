const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../db");

// ==================== REGISTRO ====================
router.post("/register", async (req, res) => {
  try {
    const { nombre, apellido, correo, password } = req.body;

    if (!nombre || !correo || !password) {
      return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
    }

    const pool = await poolPromise;

    const checkUser = await pool
      .request()
      .input("correo", sql.VarChar(150), correo)
      .query("SELECT correo FROM Usuarios WHERE correo = @correo");

    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "El correo ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool
      .request()
      .input("nombre", sql.VarChar(100), nombre)
      .input("apellido", sql.VarChar(100), apellido || null)
      .input("correo", sql.VarChar(150), correo)
      .input("contrasena", sql.VarChar(255), hashedPassword)
      .input("rol", sql.VarChar(50), "cliente")
      .query(`
        INSERT INTO Usuarios (nombre, apellido, correo, contrasena, rol)
        VALUES (@nombre, @apellido, @correo, @contrasena, @rol)
      `);

    return res.status(201).json({ success: true, message: "Usuario registrado correctamente" });
  } catch (error) {
    console.error("Error en /auth/register:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// ==================== LOGIN ====================
router.post("/login", async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ success: false, message: "Faltan credenciales" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("correo", sql.VarChar(150), correo)
      .query("SELECT id, nombre, apellido, correo, contrasena, rol FROM Usuarios WHERE correo = @correo");

    if (result.recordset.length === 0) {
      return res.status(401).json({ success: false, message: "Correo o contraseña incorrectos" });
    }

    const user = result.recordset[0];

    // 🔹 Compatibilidad con contraseñas viejas o no hasheadas
    let passwordMatch = false;
    if (user.contrasena && user.contrasena.startsWith("$2b$")) {
      passwordMatch = await bcrypt.compare(password, user.contrasena);
    } else {
      // Si no está encriptada, compara directamente (para migraciones viejas)
      passwordMatch = password === user.contrasena;
    }

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Correo o contraseña incorrectos" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        rol: user.rol,
      },
      process.env.JWT_SECRET || "mi_secreto",
      { expiresIn: "6h" }
    );

    return res.json({
      success: true,
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error("Error en /auth/login:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// ==================== PERFIL ====================
router.get("/perfil", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "mi_secreto");

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, decoded.id)
      .query("SELECT id, nombre, apellido, correo, rol FROM Usuarios WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    res.json({ success: true, user: result.recordset[0] });
  } catch (error) {
    console.error("Error en /auth/perfil:", error);
    res.status(500).json({ success: false, message: "Error al obtener perfil" });
  }
});

module.exports = router;
