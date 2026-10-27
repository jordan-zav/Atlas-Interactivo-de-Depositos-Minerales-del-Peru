<p align="center"><a href="README.md">English</a> · <strong>Español</strong></p>

# Atlas Interactivo de Depósitos Minerales del Perú

Atlas interactivo portátil para visualizar depósitos minerales y franjas metalogenéticas del Perú desde un visor web local.


## ⚖️ Licencia (Licencia Dual)

Este proyecto se distribuye bajo un modelo de **Licencia Dual**:

1. **Uso de Código Abierto (GNU GPLv3):** Puedes usar, estudiar, modificar y redistribuir este software de forma gratuita, siempre y cuando cualquier versión modificada o distribución derivada también sea 100% de código abierto bajo la licencia GNU GPLv3.
2. **Uso Comercial / Privado (Licencia Comercial):** Si deseas integrar este código en software propietario, cerrado o comercial (sin la obligación de abrir tu propio código fuente bajo la GPLv3), debes adquirir una licencia comercial exclusiva. Por favor, ponte en contacto con el autor para acordar los términos.

Para más detalles, consulta el archivo [LICENSE](LICENSE).

---

## Uso rápido

1. Ejecuta <code>iniciar_atlas.bat</code>.
2. Se abrirá un <code>localhost</code> en tu navegador con el visor.
3. Cierra la ventana de consola para detener el servidor.

## Funcionalidad

- Visualización de yacimientos mineros.
- Activación y desactivación de la franja metalogenética.
- Consulta espacial dibujando polígonos o rectángulos.
- Búsqueda de yacimientos y franjas.
- Exportación de resultados a CSV.
- Ejecución portable con rutas relativas.

## Estructura

- <code>data/</code>: fuentes originales en <code>GeoPackage</code> y <code>QML</code>.
- <code>build/</code>: datos listos para el visor web.
- <code>web/</code>: interfaz del atlas.
- <code>scripts/build_data.py</code>: conversión desde <code>gpkg</code> y extracción de simbología <code>qml</code>.
- <code>scripts/start_server.ps1</code>: servidor local portátil.

## Requisitos

- Windows con PowerShell.
- Python 3 solo si necesitas regenerar <code>build/</code> a partir de los datos fuente.

## Licencia

Este proyecto está sujeto a los términos de la licencia GNU GPLv3 y el acuerdo de Licencia Dual descrito anteriormente. Ver el archivo [LICENSE](LICENSE) para más detalles.
