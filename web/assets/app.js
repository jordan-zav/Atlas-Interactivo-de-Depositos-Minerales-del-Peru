// Copyright (c) 2026 Jordan Zavaleta
// This file is part of Atlas-Interactivo-de-Depositos-Minerales-del-Peru.
// Atlas-Interactivo-de-Depositos-Minerales-del-Peru is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const state = {
  map: null,
  baseLayer: null,
  yacimientosLayer: null,
  franjasLayer: null,
  highlightLayer: null,
  drawnItems: null,
  styles: null,
  metadata: null,
  yacimientosData: null,
  franjasData: null,
  currentMatches: [],
  queryResults: [],
  searchIndex: [],
  splitterDragging: false,
};

const appShell = document.getElementById("app-shell");
const sidebar = document.getElementById("sidebar");
const splitter = document.getElementById("splitter");
const statusPill = document.getElementById("status-pill");
const cursorCoords = document.getElementById("cursor-coords");
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const searchResults = document.getElementById("search-results");
const selectionSummary = document.getElementById("selection-summary");
const selectionBody = document.getElementById("selection-body");
const clearSelectionButton = document.getElementById("clear-selection");
const exportCsvButton = document.getElementById("export-csv");
const toggleFranjas = document.getElementById("toggle-franjas");
const toggleBase = document.getElementById("toggle-base");
const selectionColumnCount = 9;

function setStatus(message) {
  statusPill.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function featureLabel(feature) {
  const props = feature.properties || {};
  return props.UNIDAD || props.FRANJA || props.ETIQUETA || "Sin nombre";
}

function popupHtml(feature) {
  const p = feature.properties || {};
  const rows = [
    ["Unidad", p.UNIDAD],
    ["Tipo de depósito", p.COD_TIPO],
    ["SubTipo de Yacimiento", p.ST_YACIM],
    ["Elemento principal", p.ELE_PRINC],
    ["Franja", p.FRANJAMET || p.FRANJA],
    ["Latitud", p.LATITUD],
    ["Longitud", p.LONGITUD],
    ["Localidad", p.LOCALIDAD],
    ["Código", p.COD_UNICO || p.ID]
  ].filter(([, value]) => value);

  return `
    <div class="map-popup">
      <h3>${escapeHtml(featureLabel(feature))}</h3>
      <dl>
        ${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}
      </dl>
    </div>
  `;
}

function createPointIcon(feature) {
  const styleDef = state.styles.yacimientos;
  const key = feature.properties?.[styleDef.field] ?? "NULL";
  const style = styleDef.styles[key] || styleDef.styles.NULL;
  if (!style || !style.iconUrl) {
    return L.circleMarker([0, 0]);
  }

  const size = Math.max(10, Number(style.iconSize || 10) * 1.6);
  return L.icon({
    iconUrl: style.iconUrl,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    className: "deposit-icon",
  });
}

function franjaStyle(feature) {
  const styleDef = state.styles.franjas;
  const key = feature.properties?.[styleDef.field] ?? "";
  const style = styleDef.styles[key];
  return {
    color: style?.strokeColor || "rgba(90,90,90,0.8)",
    weight: Number(style?.strokeWidth || 1),
    fillColor: style?.fillColor || "rgba(180,180,180,0.45)",
    fillOpacity: 0.55,
  };
}

function setExportEnabled(enabled) {
  exportCsvButton.disabled = !enabled;
}

function formatCoord(value) {
  return Number(value).toFixed(6);
}

function updateCursorCoords(latlng) {
  cursorCoords.textContent = `Lon: ${formatCoord(latlng.lng)} | Lat: ${formatCoord(latlng.lat)}`;
}

function initMap() {
  state.map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
  }).setView([-10.5, -75.4], 6);

  state.baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(state.map);

  state.drawnItems = new L.FeatureGroup().addTo(state.map);
  state.highlightLayer = L.geoJSON(null, {
    style: {
      color: "#1f6f78",
      weight: 3,
      fillColor: "#e7c66d",
      fillOpacity: 0.22,
    },
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 9,
        color: "#1f6f78",
        weight: 3,
        fillColor: "#ffd17d",
        fillOpacity: 0.85,
      }),
  }).addTo(state.map);

  const drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        showArea: true,
      },
      rectangle: true,
      polyline: false,
      circle: false,
      circlemarker: false,
      marker: false,
    },
    edit: {
      featureGroup: state.drawnItems,
      edit: true,
      remove: true,
    },
  });
  state.map.addControl(drawControl);

  state.map.on(L.Draw.Event.CREATED, (event) => {
    state.drawnItems.clearLayers();
    state.drawnItems.addLayer(event.layer);
    runSpatialQuery(event.layer.toGeoJSON());
  });

  state.map.on(L.Draw.Event.EDITED, () => {
    const layers = state.drawnItems.getLayers();
    if (layers[0]) {
      runSpatialQuery(layers[0].toGeoJSON());
    }
  });

  state.map.on(L.Draw.Event.DELETED, () => {
    clearSelection();
  });

  state.map.on("mousemove", (event) => {
    updateCursorCoords(event.latlng);
  });

  state.map.on("mouseout", () => {
    cursorCoords.textContent = "Lon: -- | Lat: --";
  });
}

async function loadData() {
  const [styles, metadata, yacimientos, franjas] = await Promise.all([
    fetch("../build/styles.json").then((res) => res.json()),
    fetch("../build/metadata.json").then((res) => res.json()),
    fetch("../build/yacimientos_mineros.geojson").then((res) => res.json()),
    fetch("../build/franja_metalogentica.geojson").then((res) => res.json()),
  ]);

  state.styles = styles;
  state.metadata = metadata;
  state.yacimientosData = yacimientos;
  state.franjasData = franjas;
}

function renderLayers() {
  state.franjasLayer = L.geoJSON(state.franjasData, {
    style: franjaStyle,
    onEachFeature: (feature, layer) => {
      layer.bindPopup(popupHtml(feature));
    },
  }).addTo(state.map);

  state.yacimientosLayer = L.geoJSON(state.yacimientosData, {
    pointToLayer: (feature, latlng) => L.marker(latlng, { icon: createPointIcon(feature) }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(popupHtml(feature));
    },
  }).addTo(state.map);

  const group = L.featureGroup([state.franjasLayer, state.yacimientosLayer]);
  state.map.fitBounds(group.getBounds().pad(0.05));
}

function clearSelection() {
  state.drawnItems.clearLayers();
  state.highlightLayer.clearLayers();
  state.currentMatches = [];
  selectionSummary.textContent = "Todavía no hay un polígono de consulta.";
  selectionBody.innerHTML = `
    <tr>
      <td colspan="${selectionColumnCount}" class="empty-cell">Sin resultados.</td>
    </tr>
  `;
  setExportEnabled(false);
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return escapeHtml(value);
}

function formatCoordinateValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const number = Number(value);
  if (Number.isFinite(number)) {
    return escapeHtml(number.toFixed(5));
  }
  return escapeHtml(value);
}

function formatPdfLink(url) {
  if (!url) {
    return "";
  }
  const safeUrl = escapeHtml(url);
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Abrir PDF</a>`;
}

function zoomToFeature(feature) {
  state.highlightLayer.clearLayers();
  const highlight = L.geoJSON(feature, {
    style: {
      color: "#0c6a6d",
      weight: 4,
      fillColor: "#f2d27b",
      fillOpacity: 0.24,
    },
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 10,
        color: "#0c6a6d",
        weight: 3,
        fillColor: "#f2d27b",
        fillOpacity: 0.95,
      }),
  });
  highlight.eachLayer((layer) => layer.bindPopup(popupHtml(feature)));
  highlight.addTo(state.highlightLayer);

  const bounds = highlight.getBounds();
  if (bounds.isValid()) {
    state.map.fitBounds(bounds.pad(0.6));
  }

  highlight.eachLayer((layer) => {
    if (layer.openPopup) {
      layer.openPopup();
    }
  });
}

function renderSelectionTable(matches) {
  if (!matches.length) {
    selectionBody.innerHTML = `
      <tr>
        <td colspan="${selectionColumnCount}" class="empty-cell">No se encontraron depósitos dentro del polígono.</td>
      </tr>
    `;
    return;
  }

  selectionBody.innerHTML = matches.map((feature, index) => {
    const p = feature.properties || {};
    return `
      <tr data-clickable="true" data-index="${index}">
        <td>${escapeHtml(p.UNIDAD || "")}</td>
        <td>${formatCellValue(p.COD_TIPO)}</td>
        <td>${formatCellValue(p.ST_YACIM)}</td>
        <td>${formatCellValue(p.ELE_PRINC)}</td>
        <td>${formatPdfLink(p.RUTA_PDF)}</td>
        <td>${formatCoordinateValue(p.LATITUD)}</td>
        <td>${formatCoordinateValue(p.LONGITUD)}</td>
        <td>${escapeHtml(p.FRANJAMET || "")}</td>
        <td>${formatCellValue(p.LOCALIDAD)}</td>
      </tr>
    `;
  }).join("");
}

function runSpatialQuery(queryFeature) {
  const polygon = queryFeature.geometry;
  const matches = state.yacimientosData.features.filter((feature) =>
    turf.booleanPointInPolygon(feature, polygon)
  );
  state.currentMatches = matches;
  selectionSummary.textContent = `${matches.length} depósito(s) encontrados dentro del polígono dibujado.`;
  renderSelectionTable(matches);
  setExportEnabled(matches.length > 0);
}

function buildSearchIndex() {
  return [
    ...state.yacimientosData.features.map((feature) => {
      const p = feature.properties || {};
      const bag = [
        p.UNIDAD,
        p.ST_YACIM,
        p.T_YACIM,
        p.FRANJAMET,
        p.LOCALIDAD,
        p.COD_UNICO,
        p.REGISTRO,
      ].filter(Boolean).join(" ");
      return {
        kind: "yacimiento",
        feature,
        text: bag.toLowerCase(),
      };
    }),
    ...state.franjasData.features.map((feature) => {
      const p = feature.properties || {};
      const bag = [p.FRANJA, p.ETIQUETA, p.TIPO].filter(Boolean).join(" ");
      return {
        kind: "franja",
        feature,
        text: bag.toLowerCase(),
      };
    }),
  ];
}

function renderSearchResults(results, query) {
  if (!query) {
    searchResults.className = "result-list empty";
    searchResults.textContent = "Sin búsqueda activa.";
    return;
  }

  if (!results.length) {
    searchResults.className = "result-list empty";
    searchResults.textContent = "No se encontraron coincidencias.";
    return;
  }

  searchResults.className = "result-list";
  searchResults.innerHTML = results.map((item, index) => {
    const props = item.feature.properties || {};
    const title = item.kind === "franja"
      ? `${props.FRANJA || "Franja"}`
      : `${props.UNIDAD || "Yacimiento"}`;
    const meta = item.kind === "franja"
      ? props.ETIQUETA || props.TIPO || ""
      : [props.ST_YACIM, props.LOCALIDAD, props.FRANJAMET].filter(Boolean).join(" | ");
    return `
      <div class="result-item" data-search-index="${index}">
        <div class="result-title">${escapeHtml(title)}</div>
        <div class="result-meta">${escapeHtml(meta)}</div>
      </div>
    `;
  }).join("");
}

function executeSearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    state.queryResults = [];
    renderSearchResults([], "");
    return;
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  const matches = state.searchIndex
    .filter((item) => tokens.every((token) => item.text.includes(token)))
    .slice(0, 50);

  state.queryResults = matches;
  renderSearchResults(matches, query);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCurrentMatchesToCsv() {
  if (!state.currentMatches.length) {
    return;
  }

  const headers = [
    "UNIDAD",
    "COD_TIPO",
    "ST_YACIM",
    "ELE_PRINC",
    "RUTA_PDF",
    "LATITUD",
    "LONGITUD",
    "FRANJAMET",
    "LOCALIDAD"
  ];
  const lines = [
    headers.join(","),
    ...state.currentMatches.map((feature) => {
      const p = feature.properties || {};
      return headers.map((field) => csvEscape(p[field])).join(",");
    }),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  link.href = url;
  link.download = `consulta_depositos_${timestamp}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setSidebarWidth(widthPx) {
  const minWidth = 720;
  const maxWidth = Math.min(window.innerWidth * 0.94, 1600);
  const safeWidth = Math.max(minWidth, Math.min(widthPx, maxWidth));
  appShell.style.setProperty("--sidebar-width", `${safeWidth}px`);
}

function handleSplitterDrag(clientX) {
  setSidebarWidth(clientX);
  if (state.map) {
    requestAnimationFrame(() => state.map.invalidateSize());
  }
}

function initSplitter() {
  if (window.innerWidth <= 960) {
    return;
  }

  splitter.addEventListener("mousedown", (event) => {
    state.splitterDragging = true;
    splitter.classList.add("dragging");
    document.body.style.userSelect = "none";
    handleSplitterDrag(event.clientX);
  });

  window.addEventListener("mousemove", (event) => {
    if (!state.splitterDragging) {
      return;
    }
    handleSplitterDrag(event.clientX);
  });

  window.addEventListener("mouseup", () => {
    if (!state.splitterDragging) {
      return;
    }
    state.splitterDragging = false;
    splitter.classList.remove("dragging");
    document.body.style.userSelect = "";
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth <= 960) {
      appShell.style.removeProperty("--sidebar-width");
      return;
    }
    const currentWidth = sidebar.getBoundingClientRect().width;
    setSidebarWidth(currentWidth);
    if (state.map) {
      requestAnimationFrame(() => state.map.invalidateSize());
    }
  });
}

function wireUi() {
  searchButton.addEventListener("click", executeSearch);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      executeSearch();
    }
  });

  searchResults.addEventListener("click", (event) => {
    const target = event.target.closest("[data-search-index]");
    if (!target) return;
    const item = state.queryResults[Number(target.dataset.searchIndex)];
    if (item) {
      zoomToFeature(item.feature);
    }
  });

  selectionBody.addEventListener("click", (event) => {
    const row = event.target.closest("[data-index]");
    if (!row) return;
    const feature = state.currentMatches[Number(row.dataset.index)];
    if (feature) {
      zoomToFeature(feature);
    }
  });

  clearSelectionButton.addEventListener("click", clearSelection);
  exportCsvButton.addEventListener("click", exportCurrentMatchesToCsv);

  toggleFranjas.addEventListener("change", () => {
    if (toggleFranjas.checked) {
      state.franjasLayer.addTo(state.map);
    } else {
      state.map.removeLayer(state.franjasLayer);
    }
  });

  toggleBase.addEventListener("change", () => {
    if (toggleBase.checked) {
      state.baseLayer.addTo(state.map);
    } else {
      state.map.removeLayer(state.baseLayer);
    }
  });
}

async function bootstrap() {
  try {
    initMap();
    await loadData();
    if (window.innerWidth > 960) {
      setSidebarWidth(980);
    }
    renderLayers();
    state.searchIndex = buildSearchIndex();
    initSplitter();
    wireUi();
    setExportEnabled(false);
    setStatus("Atlas Interactivo de Depósitos Minerales");
  } catch (error) {
    console.error(error);
    setStatus("Error al cargar el atlas");
    searchResults.className = "result-list empty";
    searchResults.textContent = "No se pudo cargar la información del atlas.";
  }
}

bootstrap();
