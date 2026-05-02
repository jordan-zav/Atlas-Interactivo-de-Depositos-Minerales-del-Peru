# Atlas Interactivo de Depósitos Minerales del Perú

Atlas interactivo portátil para visualizar depósitos minerales y franjas metalogenéticas del Perú desde un visor web local.

## Uso rápido

1. Ejecuta `iniciar_atlas.bat`.
2. Se abrirá un `localhost` en tu navegador con el visor.
3. Cierra la ventana de consola para detener el servidor.

## Funcionalidad

- Visualización de yacimientos mineros.
- Activación y desactivación de la franja metalogenética.
- Consulta espacial dibujando polígonos o rectángulos.
- Búsqueda de yacimientos y franjas.
- Exportación de resultados a CSV.
- Ejecución portable con rutas relativas.

## Estructura

- `data/`: fuentes originales en `GeoPackage` y `QML`.
- `build/`: datos listos para el visor web.
- `web/`: interfaz del atlas.
- `scripts/build_data.py`: conversión desde `gpkg` y extracción de simbología `qml`.
- `scripts/start_server.ps1`: servidor local portátil.

## Requisitos

- Windows con PowerShell.
- Python 3 solo si necesitas regenerar `build/` a partir de los datos fuente.

## Licencia

MIT
