CREATE TABLE Reservas (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) NOT NULL,
    habitacion NVARCHAR(50) NOT NULL,
    fechaEntrada DATE NOT NULL,
    fechaSalida DATE NOT NULL,
    fechaCreacion DATETIME DEFAULT GETDATE()
);
