// =============================
//       CONFIGURACIÓN BASE
// =============================
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

// =============================
//          MIDDLEWARES
// =============================
app.use(cors());
app.use(express.json());

// =============================
//          RUTAS
// =============================
app.use("/auth", require("./routes/auth"));
app.use("/usuarios", require("./routes/usuarios"));
app.use("/reservas", require("./routes/reservas"));
app.use("/habitaciones", require("./routes/habitaciones"));
app.use("/contacto", require("./routes/contacto"));
app.use("/pagos", require("./routes/pagos"));
app.use("/reportes", require("./routes/reportes"));

// =============================
//          RUTA BASE
// =============================
app.get("/", (req, res) => {
  res.send("🚀 Backend del Hotel La Juanita está funcionando (Render)");
});

// =============================
//        INICIAR SERVIDOR
// =============================
app.listen(PORT, () => {
  console.log(`✅ Servidor backend escuchando en el puerto ${PORT}`);
});
