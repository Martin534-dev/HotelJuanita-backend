CREATE TABLE Habitaciones (
    id INT IDENTITY(1,1) PRIMARY KEY,
    numero NVARCHAR(10) UNIQUE NOT NULL,
    tipo NVARCHAR(50) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    estado NVARCHAR(20) NOT NULL DEFAULT 'disponible',
    descripcion NVARCHAR(255)
);
