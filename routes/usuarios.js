const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../db");
const bcrypt = require("bcryptjs");

// =======================================================
// LISTAR USUARIOS
// =======================================================
router.get("/", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT id, nombre, apellido, correo, rol 
      FROM Usuarios
      ORDER BY id ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error al listar usuarios:", err);
    res.status(500).json({ message: "Error al listar usuarios" });
  }
});

// =======================================================
// CREAR USUARIO (para agregar operadores desde el panel admin)
// =======================================================
router.post("/", async (req, res) => {
  try {
    const { nombre, apellido, correo, contrasena, rol } = req.body;

    if (!nombre || !correo) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios" });
    }

    // 🔹 Verificar si el usuario ya existe
    const pool = await poolPromise;
    const check = await pool
      .request()
      .input("correo", sql.NVarChar(150), correo)
      .query("SELECT id FROM Usuarios WHERE correo = @correo");

    if (check.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "El correo ya está registrado" });
    }

    // 🔹 Hashear contraseña (si no está ya hasheada)
    const hashedPassword = contrasena && contrasena.startsWith("$2b$")
      ? contrasena
      : await bcrypt.hash(contrasena || "12345", 10);

    await pool.request()
      .input("nombre", sql.NVarChar(100), nombre)
      .input("apellido", sql.NVarChar(100), apellido || "")
      .input("correo", sql.NVarChar(150), correo)
      .input("contrasena", sql.NVarChar(255), hashedPassword)
      .input("rol", sql.NVarChar(50), rol || "operador")
      .query(`
        INSERT INTO Usuarios (nombre, apellido, correo, contrasena, rol, FechaCreacion)
        VALUES (@nombre, @apellido, @correo, @contrasena, @rol, GETDATE())
      `);

    res.json({ success: true, message: "Usuario agregado correctamente" });
  } catch (err) {
    console.error("Error POST /usuarios:", err);
    res.status(500).json({ success: false, message: "Error al agregar usuario" });
  }
});

// =======================================================
// ACTUALIZAR USUARIO (con verificación de contraseña actual)
// =======================================================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, correo, rol, contrasenaActual, contrasenaNueva } = req.body;

    const pool = await poolPromise;

    // 🔹 Obtener datos actuales del usuario
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT contrasena FROM Usuarios WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const storedHash = result.recordset[0].contrasena;
    let nuevaPasswordHash = null;

    // 🔹 Si intenta cambiar contraseña, verificar la actual
    if (contrasenaNueva) {
      if (!contrasenaActual) {
        return res.status(400).json({ success: false, message: "Debes ingresar tu contraseña actual" });
      }

      const valid = storedHash.startsWith("$2b$")
        ? await bcrypt.compare(contrasenaActual, storedHash)
        : contrasenaActual === storedHash;

      if (!valid) {
        return res.status(401).json({ success: false, message: "Contraseña actual incorrecta" });
      }

      nuevaPasswordHash = await bcrypt.hash(contrasenaNueva, 10);
    }

    // 🔹 Actualizar datos
    const query = `
      UPDATE Usuarios
      SET nombre = @nombre,
          apellido = @apellido,
          correo = @correo,
          ${rol ? "rol = @rol," : ""}
          ${nuevaPasswordHash ? "contrasena = @contrasena," : ""}
          FechaCreacion = FechaCreacion
      WHERE id = @id
    `;

    const request = pool.request();
    request.input("id", sql.Int, id);
    request.input("nombre", sql.NVarChar(100), nombre);
    request.input("apellido", sql.NVarChar(100), apellido || null);
    request.input("correo", sql.NVarChar(150), correo);
    if (rol) request.input("rol", sql.NVarChar(50), rol);
    if (nuevaPasswordHash) request.input("contrasena", sql.NVarChar(255), nuevaPasswordHash);

    await request.query(query);

    res.json({ success: true, message: "Perfil actualizado correctamente" });
  } catch (err) {
    console.error("Error PUT /usuarios/:id:", err);
    res.status(500).json({ success: false, message: "Error al actualizar usuario" });
  }
});


// =======================================================
// ELIMINAR USUARIO
// =======================================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Usuarios WHERE id=@id");

    if (result.rowsAffected[0] > 0) {
      res.json({ success: true, message: `Usuario #${id} eliminado correctamente` });
    } else {
      res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
  } catch (err) {
    console.error("Error DELETE /usuarios/:id:", err);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
});

module.exports = router;
