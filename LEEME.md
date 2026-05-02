# Atlas Interactivo de Depósitos Minerales

## Uso rápido

1. Ejecuta [iniciar_atlas.bat](./iniciar_atlas.bat)
2. Se abrirá un `localhost` en tu navegador con el visor.
3. Cierra la ventana de consola para apagar el servidor.

## Qué hace

- Muestra los `yacimientos mineros`.
- Permite activar o desactivar la `franja metalogenética`.
- Permite dibujar un polígono o rectángulo para consultar qué depósitos están dentro.
- Permite buscar yacimientos o franjas y acercarlos en el mapa.

## Portabilidad

- El proyecto usa rutas relativas, así que puede moverse de carpeta o copiarse en un USB.
- El visor puede arrancar solo con PowerShell de Windows si ya existe la carpeta `build/`.
- Si modificas los `gpkg` o `qml`, y hay Python instalado, el proyecto regenera automáticamente `build/`.

## Estructura

- `data/`: fuentes originales `GeoPackage` y `QML`
- `build/`: datos listos para el visor web
- `web/`: interfaz del atlas
- `scripts/build_data.py`: conversión desde `gpkg` y extracción de simbología `qml`
- `scripts/start_server.ps1`: servidor local portátil
