/* === BLINDAJE v1.4 (2 sep 2026) — método seguro ===
   Si un id no existe en el HTML, $ devuelve un elemento suelto (no visible)
   en vez de null. Así el script NO se muere y el resto de la pantalla
   sigue funcionando. No se modifica ninguna otra línea del código. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,2200);}

let CAT = {};

$("#btn-foto").addEventListener("click", async () => {
  if (!confirm("¿Cerrar el avance de esta semana? Se guarda cómo va la obra hoy, para poder comparar contra la próxima semana.")) return;
  const r = await (await fetch("/api/snapshot", { method: "POST" })).json();
  toast("Avance de la semana cerrado (" + r.partidas + " partidas) · " + r.semana);
});

async function inicio() {
  const q = await (await fetch("/api/quien_soy")).json();
  if (!q.login) { location.href = "/login"; return; }
  CAT = await (await fetch("/api/catalogos")).json();
  // datalists
  llena("#dl-prov-hoja", CAT.proveedores);
  llena("#dl-prov-cap", CAT.proveedores);
  llena("#dl-depto-hoja", CAT.departamentos || ["Sistemas", "Herrería del hospital", "Biomédica", "Mantenimiento", "Compras"]);
  llena("#dl-r-bloque", CAT.bloques);
  llena("#dl-r-area", CAT.areas);
  llena("#dl-r-giro", CAT.giros);
  llena("#dl-r-prov", CAT.proveedores);
  llena("#dl-r-tipo", CAT.tipos_partida);
  await cargarProveedores();
  actualizarLinksHoja();
  actualizarLinksDepto();
  actualizarLinksMedida();
  actualizarPlantilla();
}

function llena(sel, items) {
  const el = $(sel);
  if (el) el.innerHTML = (items || []).map((i) => `<option value="${esc(i)}">`).join("");
}

// ---- Sección 0: captura masiva por Excel ----
function actualizarPlantilla() {
  const p = $("#sel-prov-cap").value.trim();
  const q = p ? "?proveedor=" + encodeURIComponent(p) : "";
  $("#btn-plantilla").href = "/api/plantilla_captura.xlsx" + q;
}
$("#sel-prov-cap").addEventListener("input", actualizarPlantilla);
$("#sel-prov-cap").addEventListener("change", actualizarPlantilla);

$("#btn-importar").addEventListener("click", async () => {
  const inp = $("#file-importar");
  if (!inp.files || !inp.files.length) { toast("Primero elige el archivo Excel"); return; }
  const fd = new FormData();
  fd.append("archivo", inp.files[0]);
  $("#btn-importar").disabled = true;
  $("#btn-importar").textContent = "Importando…";
  try {
    const r = await (await fetch("/api/importar_avances", { method: "POST", body: fd })).json();
    const box = $("#importar-result");
    box.hidden = false;
    if (r.error) {
      box.className = "cap-result cap-error";
      box.innerHTML = "⚠️ " + esc(r.error);
    } else {
      box.className = "cap-result cap-ok";
      let msg = `✅ Se actualizaron <b>${r.actualizadas}</b> partidas.`;
      if (r.sin_coincidencia && r.sin_coincidencia.length)
        msg += `<br>⚠️ ${r.sin_coincidencia.length} códigos no se encontraron: ${r.sin_coincidencia.slice(0,8).map(esc).join(", ")}${r.sin_coincidencia.length>8?"…":""}`;
      if (r.errores) msg += `<br>${r.errores} celdas de avance con valor no numérico se ignoraron.`;
      box.innerHTML = msg;
      await cargarProveedores();
    }
  } catch (e) {
    const box = $("#importar-result");
    box.hidden = false; box.className = "cap-result cap-error";
    box.textContent = "No se pudo subir el archivo. ¿La plataforma sigue corriendo?";
  }
  $("#btn-importar").disabled = false;
  $("#btn-importar").textContent = "Importar avances";
});

// ---- Sección 1: hoja por proveedor ----
function actualizarLinksHoja() {
  const p = $("#sel-prov-hoja").value.trim();
  const q = p ? "?proveedor=" + encodeURIComponent(p) : "";
  $("#btn-hoja-pdf").href = "/api/hoja_proveedor.pdf" + q;
  $("#btn-hoja-xlsx").href = "/api/hoja_proveedor.xlsx" + q;
  $("#hoja-hint").textContent = p ? "Se generará la hoja de: " + p
    : "Elige un proveedor. (Si lo dejas vacío, la hoja trae todas las partidas.)";
}
$("#sel-prov-hoja").addEventListener("input", actualizarLinksHoja);
$("#sel-prov-hoja").addEventListener("change", actualizarLinksHoja);

// ---- Sección 1.5: hoja por departamento interno ----
function actualizarLinksDepto() {
  const d = $("#sel-depto-hoja") ? $("#sel-depto-hoja").value.trim() : "";
  const q = d ? "?departamento=" + encodeURIComponent(d) : "";
  if ($("#btn-depto-pdf")) $("#btn-depto-pdf").href = "/api/hoja_departamento.pdf" + q;
  if ($("#btn-depto-xlsx")) $("#btn-depto-xlsx").href = "/api/hoja_departamento.xlsx" + q;
  if ($("#depto-hint")) {
    $("#depto-hint").textContent = d ? "Se generará la hoja del departamento: " + d
      : "Elige un departamento. (Si lo dejas vacío, la hoja trae todas las partidas internas.)";
  }
}
if ($("#sel-depto-hoja")) {
  $("#sel-depto-hoja").addEventListener("input", actualizarLinksDepto);
  $("#sel-depto-hoja").addEventListener("change", actualizarLinksDepto);
}


// ---- Sección 2: avance por proveedor ----
async function cargarProveedores() {
  const data = await (await fetch("/api/resumen_proveedores")).json();
  $("#tbody-prov").innerHTML = data.map((p) => {
    const cls = p.avance >= 75 ? "alto" : p.avance < 35 ? "bajo" : "";
    const ret = p.retrasadas > 0 ? `<span class="pill-rojo">${p.retrasadas}</span>` : "0";
    return `<tr>
      <td>${esc(p.proveedor)}</td>
      <td>${p.total}</td>
      <td>${p.listas}</td>
      <td>${ret}</td>
      <td class="der"><span class="pct">${p.avance}%</span></td>
      <td><div class="barra-mini"><div class="barra-mini-fill ${cls}" style="width:${p.avance}%"></div></div></td>
    </tr>`;
  }).join("");
}

// ---- Sección 3: reporte a la medida ----
function paramsMedida() {
  const map = { "#r-bloque": "bloque", "#r-area": "area", "#r-giro": "giro",
                "#r-prov": "proveedor", "#r-tipo": "tipo_partida" };
  const p = new URLSearchParams();
  for (const [sel, key] of Object.entries(map)) {
    const v = $(sel).value.trim();
    if (v) p.set(key, v);
  }
  if ($("#r-retraso").checked) p.set("solo_retraso", "1");
  p.set("titulo", "Reporte de actividades");
  return p.toString();
}
function actualizarLinksMedida() {
  const q = "?" + paramsMedida();
  $("#btn-med-pdf").href = "/api/hoja_proveedor.pdf" + q;
  $("#btn-med-xlsx").href = "/api/hoja_proveedor.xlsx" + q;
  graficaMedidaDebounced();
}

// ---- Gráfica del reporte a la medida: avance por proveedor + estatus ----
function esRetrasada(a) {
  if (!a.f_fin || (a.avance || 0) >= 100) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(a.f_fin + "T00:00:00");
  return fin < hoy;
}

let _graficaMedidaTimer = null;
function graficaMedidaDebounced() {
  clearTimeout(_graficaMedidaTimer);
  _graficaMedidaTimer = setTimeout(actualizarGraficaMedida, 300);
}

async function actualizarGraficaMedida() {
  let datos;
  try {
    datos = await (await fetch("/api/actividades?" + paramsMedida())).json();
    if (!Array.isArray(datos)) datos = [];
  } catch (e) {
    return;
  }
  if ($("#r-retraso").checked) datos = datos.filter(esRetrasada);

  // barras: avance promedio por proveedor/departamento, peor primero
  const grupos = new Map();
  datos.forEach((a) => {
    // igual que el resto de la plataforma: proveedor manda; departamento
    // solo aplica en el mundo "interno" (donde no hay proveedor).
    const clave = a.proveedor || a.departamento || "Sin asignar";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(a.avance || 0);
  });
  const filas = [...grupos.entries()]
    .map(([clave, avs]) => ({
      clave, n: avs.length,
      av: Math.round(avs.reduce((s, v) => s + v, 0) / avs.length),
    }))
    .sort((x, y) => x.av - y.av);
  const contProv = $("#med-graf-proveedor");
  contProv.innerHTML = filas.length
    ? filas.map((f) => `
      <div class="med-graf-fila">
        <span class="med-graf-etiqueta" title="${esc(f.clave)}">${esc(f.clave)} <small style="color:#8a94a3">(${f.n})</small></span>
        <div class="barra-mini"><div class="barra-mini-fill ${f.av >= 75 ? "alto" : f.av < 35 ? "bajo" : ""}" style="width:${f.av}%"></div></div>
        <span class="pct">${f.av}%</span>
      </div>`).join("")
    : `<p class="med-graf-vacio">Sin actividades con estos filtros.</p>`;

  // tarjetas: conteo por estatus
  let listas = 0, proceso = 0, pendientes = 0, retrasadas = 0;
  datos.forEach((a) => {
    const av = a.avance || 0;
    if (esRetrasada(a)) retrasadas++;
    if (av >= 100) listas++; else if (av > 0) proceso++; else pendientes++;
  });
  $("#med-graf-estatus").innerHTML = `
    <div class="med-graf-tiles">
      <div class="med-graf-tile listo"><b>${listas}</b><span>Listas</span></div>
      <div class="med-graf-tile proceso"><b>${proceso}</b><span>En proceso</span></div>
      <div class="med-graf-tile pendiente"><b>${pendientes}</b><span>Pendientes</span></div>
      <div class="med-graf-tile retraso"><b>${retrasadas}</b><span>Retrasadas</span></div>
    </div>`;
}

["#r-bloque", "#r-area", "#r-giro", "#r-prov", "#r-tipo"].forEach((s) => {
  $(s).addEventListener("input", actualizarLinksMedida);
  $(s).addEventListener("change", actualizarLinksMedida);
});
$("#r-retraso").addEventListener("change", actualizarLinksMedida);
$("#btn-med-limpiar").addEventListener("click", () => {
  ["#r-bloque", "#r-area", "#r-giro", "#r-prov", "#r-tipo"].forEach((s) => ($(s).value = ""));
  $("#r-retraso").checked = false;
  actualizarLinksMedida();
});

inicio();
