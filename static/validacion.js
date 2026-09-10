/* === BLINDAJE v1.4 (2 sep 2026) — método seguro ===
   Si un id no existe en el HTML, $ devuelve un elemento suelto (no visible)
   en vez de null. Así el script NO se muere y el resto de la pantalla
   sigue funcionando. No se modifica ninguna otra línea del código. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
const $$ = (s) => document.querySelectorAll(s);
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,2200);}

const DEDONDE = { plano:"Venía en plano", adicional:"Adicional en obra", comentario:"Comentario/indicación" };

let AVANCES = [], PROPUESTAS = [], NORECO = [], RECHAZADAS = [];
let GRUPOS_ABIERTOS = {}; // {clave: true} para recordar cuáles están abiertos
let CATALOGOS = {}, CAUSAS_OBRA = [], CAUSAS_INTERNO = [];

function llenarDatalist(sel, items){ $(sel).innerHTML = (items||[]).map(i=>`<option value="${esc(i)}">`).join(""); }

async function cargarCatalogosEdicion(){
  CATALOGOS = await (await fetch("/api/catalogos")).json();
  llenarDatalist("#dl-ed-bloque", CATALOGOS.bloques);
  llenarDatalist("#dl-ed-giro", CATALOGOS.giros);
  CAUSAS_OBRA = await (await fetch("/api/causas?mundo=obra")).json();
  CAUSAS_INTERNO = await (await fetch("/api/causas?mundo=interno")).json();
}

function getResponsable(a) {
  if (a.mundo === "interno") {
    return a.departamento || a.proveedor || "Interno HAP";
  }
  return a.proveedor || a.departamento || "Externo";
}

async function cargar() {
  const q = await (await fetch("/api/quien_soy")).json();
  if (!q.login) { location.href = "/login"; return; }
  if (q.rol !== "admin" && q.rol !== "supervisor") { location.href = "/portal"; return; }
  if (!CATALOGOS.bloques) await cargarCatalogosEdicion();
  const d = await (await fetch("/api/validacion/pendientes")).json();
  AVANCES = d.avances || [];
  PROPUESTAS = d.propuestas || [];
  renderAvances();
  renderPropuestas();
  await cargarAtencion();
}

/* ============================================================
   AGRUPAR POR PROVEEDOR — función auxiliar
   ============================================================ */
function agruparPor(lista, campo) {
  const grupos = {};
  const orden = [];
  for (const a of lista) {
    const clave = (typeof campo === "function" ? campo(a) : a[campo]) || "Sin asignar";
    if (!grupos[clave]) { grupos[clave] = []; orden.push(clave); }
    grupos[clave].push(a);
  }
  return { grupos, orden };
}

/* ============================================================
   RENDER AVANCES — agrupados por proveedor/bloque/área, contraíbles
   ============================================================ */
function renderAvances() {
  $("#cont-av").textContent = AVANCES.length;
  $("#vacio-av").hidden = AVANCES.length > 0;
  $("#masa-av").hidden = AVANCES.length === 0;

  if (!AVANCES.length) {
    $("#tbody-av").innerHTML = "";
    const zona = document.getElementById("zona-av-grupos");
    if (zona) zona.innerHTML = "";
    return;
  }

  // Filtrar
  const filtro = (document.getElementById("filtro-av") || {}).value || "";
  const fl = filtro.toLowerCase();
  const avFilt = fl ? AVANCES.filter(a =>
    (getResponsable(a)).toLowerCase().includes(fl) ||
    (a.bloque||"").toLowerCase().includes(fl) ||
    (a.area||"").toLowerCase().includes(fl) ||
    (a.partida||"").toLowerCase().includes(fl) ||
    (a.codigo||"").toLowerCase().includes(fl)
  ) : AVANCES;

  // Agrupar según selector
  const agruparPorCampo = (document.getElementById("agrupar-av") || {}).value || "proveedor";
  let campoFn;
  if (agruparPorCampo === "bloque") campoFn = a => a.bloque || "Sin bloque";
  else if (agruparPorCampo === "area") campoFn = a => a.area || "Sin área";
  else campoFn = getResponsable;

  const { grupos, orden } = agruparPor(avFilt, campoFn);
  
  let html = "";
  for (const clave of orden) {
    const acts = grupos[clave];
    const ids = acts.map(a => a.id);
    const btnFirmar = `<button class="v-ok v-grupo-btn" data-firmar-grupo='${JSON.stringify(ids)}'>Firmar ${acts.length}</button>`;
    html += grupoHtml(clave, acts, btnFirmar) + `
        <table class="v-tabla"><thead><tr>
          <th>Proveedor</th><th>Código</th><th>Bloque</th><th>Área</th><th>Partida</th>
          <th>Oficial</th><th>Reportado</th><th>De dónde</th><th></th>
        </tr></thead><tbody>`;
    for (const a of acts) {
      html += `<tr data-id="${a.id}" class="fila-click" data-ver-act='${JSON.stringify(a.id)}'>
        <td><b>${esc(getResponsable(a))}</b></td>
        <td class="mono">${esc(a.codigo||"")}</td>
        <td>${esc(a.bloque||"")}</td>
        <td>${esc(a.area||"")}</td>
        <td class="v-part">${esc(a.partida||"")}</td>
        <td class="v-cen">${a.avance||0}%</td>
        <td class="v-cen v-nuevo">${a.avance_decl}%</td>
        <td>${DEDONDE[a.definido_por]||"—"}</td>
        <td class="v-btns">
          <button class="v-ok" data-id="${a.id}">Firmar</button>
          <button class="v-no" data-id="${a.id}">Rechazar</button>
        </td>
      </tr>`;
    }
    html += `</tbody></table></div></div>`;
  }

  if (!avFilt.length) {
    html = `<p class="v-vacio">No hay resultados para "${esc(filtro)}".</p>`;
  }
  
  let zona = document.getElementById("zona-av-grupos");
  if (!zona) {
    zona = document.createElement("div");
    zona.id = "zona-av-grupos";
    const tablaOrig = $("#tabla-av");
    tablaOrig.style.display = "none";
    tablaOrig.parentElement.appendChild(zona);
  }
  zona.innerHTML = html;
  
  enlazarGrupos();
  enlazar();
}

/* ============================================================
   RENDER PROPUESTAS — igual que antes pero agrupadas
   ============================================================ */
function renderPropuestas() {
  $("#cont-prop").textContent = PROPUESTAS.length;
  $("#vacio-prop").hidden = PROPUESTAS.length > 0;

  if (!PROPUESTAS.length) {
    $("#tbody-prop").innerHTML = "";
    const zona = document.getElementById("zona-prop-grupos");
    if (zona) zona.innerHTML = "";
    return;
  }

  // Filtrar
  const filtro = (document.getElementById("filtro-av") || {}).value || "";
  const fl = filtro.toLowerCase();
  const propFilt = fl ? PROPUESTAS.filter(a =>
    (getResponsable(a)).toLowerCase().includes(fl) ||
    (a.bloque||"").toLowerCase().includes(fl) ||
    (a.area||"").toLowerCase().includes(fl) ||
    (a.partida||"").toLowerCase().includes(fl) ||
    (a.codigo||"").toLowerCase().includes(fl)
  ) : PROPUESTAS;

  const { grupos, orden } = agruparPor(propFilt, getResponsable);
  
  let html = "";
  for (const prov of orden) {
    const acts = grupos[prov];
    const ids = acts.map(a => a.id);
    const btnAprobar = `<button class="v-ok v-grupo-btn" data-firmar-grupo='${JSON.stringify(ids)}'>Aprobar ${acts.length}</button>`;
    html += grupoHtml(prov, acts, btnAprobar) + `
        <table class="v-tabla"><thead><tr>
          <th>Código</th><th>Bloque</th><th>Área</th><th>Partida</th>
          <th>Avance</th><th>De dónde</th><th>Comentario</th><th></th>
        </tr></thead><tbody>`;
    for (const a of acts) {
      const fueraBadge = a.fuera_zona ? `<span class="badge-fuera-zona">⚠️ FUERA DE ZONA</span>` : "";
      const filaClase = a.fuera_zona ? `fila-fuera-zona` : "";
      html += `<tr data-id="${a.id}" class="${filaClase} fila-click" data-ver-act='${JSON.stringify(a.id)}'>
        <td class="mono">${esc(a.codigo||"")} ${fueraBadge}</td>
        <td>${esc(a.bloque||"—")}</td>
        <td>${esc(a.area||"—")}</td>
        <td class="v-part">${esc(a.partida||"")}</td>
        <td class="v-cen">${a.avance_decl||0}%</td>
        <td>${DEDONDE[a.definido_por]||"—"}</td>
        <td class="v-coment">${esc(a.nota_proveedor||"")}</td>
        <td class="v-btns">
          <button class="v-ok" data-id="${a.id}">Aprobar</button>
          <button class="v-no" data-id="${a.id}">Rechazar</button>
        </td>
      </tr>`;
    }
    html += `</tbody></table></div></div>`;
  }
  
  let zona = document.getElementById("zona-prop-grupos");
  if (!zona) {
    zona = document.createElement("div");
    zona.id = "zona-prop-grupos";
    const tablaOrig = $("#tabla-prop");
    tablaOrig.style.display = "none";
    tablaOrig.parentElement.appendChild(zona);
  }
  zona.innerHTML = html;
  
  enlazarGrupos();
  enlazar();
}

/* ============================================================
   NECESITAN ATENCIÓN — agrupados + búsqueda
   ============================================================ */
async function cargarAtencion() {
  const d = await (await fetch("/api/validacion/atencion")).json();
  NORECO = d.no_reconocidas || [];
  RECHAZADAS = d.rechazadas || [];
  $("#cont-aten").textContent = NORECO.length + RECHAZADAS.length;
  renderAtencion();
}

function renderAtencion() {
  const filtro = (document.getElementById("filtro-atencion") || {}).value || "";
  const fl = filtro.toLowerCase();
  
  // Filtrar no reconocidas
  const norecoFilt = fl ? NORECO.filter(a =>
    (a.proveedor||"").toLowerCase().includes(fl) ||
    (a.departamento||"").toLowerCase().includes(fl) ||
    (a.bloque||"").toLowerCase().includes(fl) ||
    (a.area||"").toLowerCase().includes(fl) ||
    (a.partida||"").toLowerCase().includes(fl) ||
    (a.codigo||"").toLowerCase().includes(fl)
  ) : NORECO;
  
  // Agrupar por proveedor
  const { grupos: gNR, orden: oNR } = agruparPor(norecoFilt, getResponsable);
  
  let htmlNR = "";
  for (const prov of oNR) {
    const acts = gNR[prov];
    htmlNR += grupoHtml(prov, acts) + `
        <table class="v-tabla"><thead><tr>
          <th>Código</th><th>Bloque</th><th>Área</th><th>Partida</th><th>Qué dijo</th><th></th>
        </tr></thead><tbody>`;
    for (const a of acts) {
      htmlNR += `<tr>
        <td class="mono">${esc(a.codigo||"")}</td>
        <td>${esc(a.bloque||"—")}</td>
        <td>${esc(a.area||"—")}</td>
        <td class="v-part">${esc(a.partida||"")}</td>
        <td class="v-coment">${esc(a.no_reconocida_nota||"")}</td>
        <td class="v-btns">
          <button class="v-editar" data-acc="editar" data-ctx="noreco" data-id="${a.id}">✎ Editar</button>
          <button class="v-ok2" data-id="${a.id}">Ya lo corregí</button>
        </td>
      </tr>`;
    }
    htmlNR += `</tbody></table></div></div>`;
  }
  
  let zonaNR = document.getElementById("zona-noreco-grupos");
  if (!zonaNR) {
    zonaNR = document.createElement("div");
    zonaNR.id = "zona-noreco-grupos";
    const tablaOrig = $("#tabla-noreco");
    tablaOrig.style.display = "none";
    tablaOrig.parentElement.appendChild(zonaNR);
  }
  zonaNR.innerHTML = norecoFilt.length ? htmlNR : "";
  $("#vacio-noreco").hidden = norecoFilt.length > 0;

  // Rechazadas
  const rechFilt = fl ? RECHAZADAS.filter(a =>
    (a.proveedor||"").toLowerCase().includes(fl) ||
    (a.departamento||"").toLowerCase().includes(fl) ||
    (a.bloque||"").toLowerCase().includes(fl) ||
    (a.area||"").toLowerCase().includes(fl) ||
    (a.partida||"").toLowerCase().includes(fl) ||
    (a.codigo||"").toLowerCase().includes(fl)
  ) : RECHAZADAS;
  
  const { grupos: gR, orden: oR } = agruparPor(rechFilt, getResponsable);
  
  let htmlR = "";
  for (const prov of oR) {
    const acts = gR[prov];
    htmlR += grupoHtml(prov, acts) + `
        <table class="v-tabla"><thead><tr>
          <th>Código</th><th>Bloque</th><th>Área</th><th>Partida</th><th>Motivo</th><th></th>
        </tr></thead><tbody>`;
    for (const a of acts) {
      htmlR += `<tr>
        <td class="mono">${esc(a.codigo||"")}</td>
        <td>${esc(a.bloque||"—")}</td>
        <td>${esc(a.area||"—")}</td>
        <td class="v-part">${esc(a.partida||"")}</td>
        <td class="v-coment">${esc(a.rechazo_motivo||"Rechazado por administración")}</td>
        <td class="v-btns">
          <button class="v-editar" data-acc="editar" data-ctx="rechazada" data-id="${a.id}">✎ Editar</button>
          <button class="v-ok2" data-id="${a.id}">Reactivar</button>
        </td>
      </tr>`;
    }
    htmlR += `</tbody></table></div></div>`;
  }
  
  let zonaR = document.getElementById("zona-rech-grupos");
  if (!zonaR) {
    zonaR = document.createElement("div");
    zonaR.id = "zona-rech-grupos";
    const tablaOrig = $("#tabla-rech");
    tablaOrig.style.display = "none";
    tablaOrig.parentElement.appendChild(zonaR);
  }
  zonaR.innerHTML = rechFilt.length ? htmlR : "";
  $("#vacio-rech").hidden = rechFilt.length > 0;

  // Enlazar botones
  enlazarGrupos();
  
  $$("#zona-noreco-grupos .v-ok2").forEach(b => b.onclick = async () => {
    await fetch("/api/validacion/limpiar_no_reconocida/" + b.dataset.id, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    toast("Marca quitada"); await cargar();
  });
  $$('#zona-noreco-grupos [data-acc="editar"]').forEach(b => b.onclick = () => abrirEditar(b.dataset.id, "noreco", NORECO));

  $$("#zona-rech-grupos .v-ok2").forEach(b => b.onclick = async () => {
    await fetch("/api/validacion/reactivar/" + b.dataset.id, {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    toast("Reactivada — vuelve a propuestas"); await cargar();
  });
  $$('#zona-rech-grupos [data-acc="editar"]').forEach(b => b.onclick = () => abrirEditar(b.dataset.id, "rechazada", RECHAZADAS));
}

/* ============================================================
   GRUPOS — expandir/contraer + firmar por grupo
   ============================================================ */
function enlazarGrupos() {
  $$("[data-toggle=grupo]").forEach(h => {
    const clave = h.querySelector("b").textContent;
    h.onclick = (e) => {
      if (e.target.closest("button")) return;
      const body = h.nextElementSibling;
      const flecha = h.querySelector(".v-grupo-flecha");
      if (body.classList.contains("cerrado")) {
        body.classList.remove("cerrado");
        flecha.textContent = "▼";
        GRUPOS_ABIERTOS[clave] = true;
      } else {
        body.classList.add("cerrado");
        flecha.textContent = "▶";
        delete GRUPOS_ABIERTOS[clave];
      }
    };
  });
  
  $$("[data-firmar-grupo]").forEach(b => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const ids = JSON.parse(b.dataset.firmarGrupo);
      const prov = b.closest(".v-grupo-header").querySelector("b").textContent;
      if (!confirm(`¿Firmar los ${ids.length} avances de ${prov}?`)) return;
      await fetch("/api/validacion/aprobar_todas", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ ids }),
      });
      toast(`${ids.length} avances firmados ✓`);
      await cargar();
    };
  });
}

// Helper: genera HTML de grupo respetando estado abierto/cerrado guardado
function grupoHtml(clave, contenido, botones) {
  const abierto = GRUPOS_ABIERTOS[clave];
  const flecha = abierto ? "▼" : "▶";
  const bodyClass = abierto ? "v-grupo-body" : "v-grupo-body cerrado";
  return `<div class="v-grupo">
    <div class="v-grupo-header" data-toggle="grupo">
      <span class="v-grupo-flecha">${flecha}</span>
      <b>${esc(clave)}</b>
      <span class="v-grupo-count">${contenido.length}</span>
      <span class="v-grupo-spacer"></span>
      ${botones || ""}
    </div>
    <div class="${bodyClass}">`;
}

function enlazar() {
  $$(".v-grupo .v-ok:not(.v-grupo-btn)").forEach(b => b.onclick = (e) => { e.stopPropagation(); firmar(b.dataset.id); });
  $$(".v-grupo .v-no").forEach(b => b.onclick = (e) => { e.stopPropagation(); abrirModalRechazo(b.dataset.id); });
  
  // Click en fila para ver detalle
  $$(".fila-click").forEach(fila => {
    fila.onclick = (e) => {
      if (e.target.closest("button")) return;
      const id = fila.dataset.verAct;
      if (!id) return;
      const a = [...AVANCES, ...PROPUESTAS].find(x => String(x.id) === String(id));
      if (a) mostrarDetalle(a);
    };
  });
}

/* ============================================================
   DETALLE DE ACTIVIDAD — panel lateral al hacer clic en fila
   ============================================================ */
function mostrarDetalle(a) {
  const prov = getResponsable(a);
  const html = `
    <div style="margin-bottom:12px">
      <span class="mono" style="font-size:16px;font-weight:700">${esc(a.codigo||"")}</span>
      <span style="margin-left:8px;color:#64748b">${esc(prov)}</span>
    </div>
    <div class="det-grid">
      <div class="det-item"><div class="det-label">Bloque</div><div>${esc(a.bloque||"—")}</div></div>
      <div class="det-item"><div class="det-label">Área</div><div>${esc(a.area||"—")}</div></div>
      <div class="det-item"><div class="det-label">Especialidad</div><div>${esc(a.giro||"—")}</div></div>
      <div class="det-item"><div class="det-label">Tipo de partida</div><div>${esc(a.tipo_partida||"—")}</div></div>
    </div>
    <div style="margin:12px 0;padding:10px;background:#f8fafc;border-radius:8px">
      <div class="det-label">Partida / Actividad</div>
      <div style="font-weight:500">${esc(a.partida||"—")}</div>
    </div>
    <div class="det-grid">
      <div class="det-item"><div class="det-label">Avance oficial</div><div style="font-size:18px;font-weight:700">${a.avance||0}%</div></div>
      <div class="det-item"><div class="det-label">Reportado</div><div style="font-size:18px;font-weight:700;color:#2563eb">${a.avance_decl!=null?a.avance_decl+"%":"—"}</div></div>
      <div class="det-item"><div class="det-label">Estatus</div><div>${esc(a.estatus||"—")}</div></div>
      <div class="det-item"><div class="det-label">De dónde</div><div>${DEDONDE[a.definido_por]||"—"}</div></div>
    </div>
    <div class="det-grid" style="margin-top:8px">
      <div class="det-item"><div class="det-label">Fecha inicio</div><div>${esc(a.f_inicio||"—")}</div></div>
      <div class="det-item"><div class="det-label">Fecha compromiso</div><div>${esc(a.f_fin||"—")}</div></div>
      <div class="det-item"><div class="det-label">Reconocida</div><div>${a.reconocida==="SÍ"?"✅ Sí":"❌ No"}</div></div>
      <div class="det-item"><div class="det-label">Aplica</div><div>${esc(a.aplica||"—")}</div></div>
    </div>
    ${a.notas?`<div style="margin-top:12px;padding:10px;background:#fef9c3;border-radius:8px;font-size:13px"><div class="det-label">Notas</div>${esc(a.notas)}</div>`:""}
    ${a.nota_proveedor?`<div style="margin-top:8px;padding:10px;background:#dbeafe;border-radius:8px;font-size:13px"><div class="det-label">Comentario del proveedor</div>${esc(a.nota_proveedor)}</div>`:""}
    <div style="display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb">
      <button class="v-ok" onclick="firmarYCerrar(${a.id})" style="flex:1;padding:10px">✅ Firmar</button>
      <button class="v-no" onclick="rechazarYCerrar(${a.id})" style="flex:1;padding:10px">Rechazar</button>
    </div>`;
  
  $("#panel-detalle-cuerpo").innerHTML = html;
  $("#panel-detalle-titulo").textContent = a.codigo || "Detalle";
  $("#overlay-detalle").hidden = false;
  $("#panel-detalle").hidden = false;
}

function cerrarPanelDetalle() {
  $("#overlay-detalle").hidden = true;
  $("#panel-detalle").hidden = true;
}

window.firmarYCerrar = async (id) => {
  await firmar(id);
  cerrarPanelDetalle();
};
window.rechazarYCerrar = (id) => {
  cerrarPanelDetalle();
  setTimeout(() => abrirModalRechazo(id), 100);
};

/* ---------- editar y corregir (todos los campos, igual que el panel) ---------- */
function llenarProveedorSegunMundo(mundo){
  const lista = mundo === "interno" ? (CATALOGOS.departamentos||[]) : (CATALOGOS.proveedores||[]);
  llenarDatalist("#dl-ed-proveedor", lista);
  $("#ed-lbl-prov").textContent = mundo === "interno" ? "Departamento" : "Proveedor";
}
function llenarAreasSegunBloque(){
  const bloque = $("#ed-bloque").value;
  const mapa = CATALOGOS.mapa_bloque_areas || {};
  const areas = bloque && mapa[bloque] ? mapa[bloque] : (CATALOGOS.areas||[]);
  llenarDatalist("#dl-ed-area", areas);
}
async function llenarDependenciasEd(propioId, seleccion, bloque, area){
  const sel = $("#ed-depende");
  if (!bloque && !area) { sel.innerHTML = '<option value="">— Ninguna —</option>'; return; }
  const params = new URLSearchParams();
  if (bloque) params.set("bloque", bloque);
  if (area) params.set("area", area);
  params.set("mundo", "todos");
  const lista = await (await fetch("/api/actividades?" + params.toString())).json();
  const ops = lista.filter(a => a.id != propioId)
    .map(a => `<option value="${a.id}">${esc(a.codigo)} · ${esc((a.partida||"").slice(0,45))}</option>`).join("");
  sel.innerHTML = '<option value="">— Ninguna —</option>' + ops;
  if (seleccion) sel.value = seleccion;
}

function abrirEditar(id, contexto, lista) {
  const a = lista.find(x => String(x.id) === String(id));
  if (!a) return;
  const mundo = a.mundo || "obra";
  $("#ed-id").value = id;
  $("#ed-contexto").value = contexto;
  $("#ed-mundo").value = mundo;
  $("#ed-codigo").textContent = a.codigo || "";
  llenarProveedorSegunMundo(mundo);
  llenarDatalist("#dl-ed-causa", mundo === "interno" ? CAUSAS_INTERNO : CAUSAS_OBRA);
  $("#ed-bloque").value = a.bloque || "";
  llenarAreasSegunBloque();
  $("#ed-area").value = a.area || "";
  $("#ed-giro").value = a.giro || "";
  $("#ed-proveedor").value = (mundo === "interno" ? a.departamento : a.proveedor) || "";
  $("#ed-partida").value = a.partida || "";
  $("#ed-tipo-partida").value = a.tipo_partida || "Construcción";
  $("#ed-definido").value = a.definido || "NO";
  $("#ed-aplica").value = a.aplica || "SÍ";
  $("#ed-avance").value = a.avance || 0;
  $("#ed-inicio").value = a.f_inicio || "";
  $("#ed-fin").value = a.f_fin || "";
  $("#ed-duracion").value = a.duracion_dias || "";
  $("#ed-estatus").value = a.estatus || "Pendiente";
  $("#ed-causa").value = a.causa_retraso || "";
  $("#ed-nota-prov").value = a.nota_proveedor || "";
  $("#ed-notas").value = a.notas || "";
  llenarDependenciasEd(a.id, a.depende_de, a.bloque, a.area);
  $("#ed-titulo").textContent = contexto === "noreco" ? "Corregir y quitar marca" : "Corregir y reactivar";
  $("#btn-guardar-editar").textContent = contexto === "noreco" ? "Guardar y quitar marca" : "Guardar y reactivar";
  mostrarEditar();
}
function mostrarEditar(){
  $("#overlay-ed").hidden = false; $("#overlay-ed").style.display = "block";
  $("#panel-editar").hidden = false; $("#panel-editar").style.display = "flex";
}
function cerrarEditar() {
  $("#overlay-ed").hidden = true; $("#overlay-ed").style.display = "none";
  $("#panel-editar").hidden = true; $("#panel-editar").style.display = "none";
}
$("#btn-cerrar-editar").onclick = cerrarEditar;
$("#btn-cancelar-editar").onclick = cerrarEditar;
$("#overlay-ed").onclick = cerrarEditar;

$("#ed-bloque").addEventListener("change", () => { llenarAreasSegunBloque(); llenarDependenciasEd($("#ed-id").value, $("#ed-depende").value, $("#ed-bloque").value, $("#ed-area").value); });
$("#ed-bloque").addEventListener("input", () => { llenarAreasSegunBloque(); });
$("#ed-area").addEventListener("change", () => llenarDependenciasEd($("#ed-id").value, $("#ed-depende").value, $("#ed-bloque").value, $("#ed-area").value));

// mini "+ agregar" rapido
$$('#panel-editar [data-add]').forEach(btn => {
  btn.onclick = async () => {
    const clase = btn.dataset.add;
    if (clase === "causa") {
      const nombre = (prompt("Nueva causa de retraso:") || "").trim();
      if (!nombre) return;
      const mundo = $("#ed-mundo").value;
      await fetch("/api/causas", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ nombre, mundo }) });
      if (mundo === "interno") CAUSAS_INTERNO.push(nombre); else CAUSAS_OBRA.push(nombre);
      llenarDatalist("#dl-ed-causa", mundo === "interno" ? CAUSAS_INTERNO : CAUSAS_OBRA);
      $("#ed-causa").value = nombre;
      return;
    }
    if (clase === "proveedor") {
      const nombre = (prompt("Nombre del proveedor/departamento nuevo:") || "").trim();
      if (!nombre) return;
      await fetch("/api/expediente", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ nombre, tipo: $("#ed-mundo").value === "interno" ? "Interno" : "Externo" }) });
      const mundo = $("#ed-mundo").value;
      if (mundo === "interno") CATALOGOS.departamentos = [...(CATALOGOS.departamentos||[]), nombre];
      else CATALOGOS.proveedores = [...(CATALOGOS.proveedores||[]), nombre];
      llenarProveedorSegunMundo(mundo);
      $("#ed-proveedor").value = nombre;
      return;
    }
    const nombre = (prompt(`Nuevo ${clase}:`) || "").trim();
    if (!nombre) return;
    await fetch("/api/catalogo/" + clase, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ nombre }) });
    if (clase === "bloque") { CATALOGOS.bloques = [...(CATALOGOS.bloques||[]), nombre]; llenarDatalist("#dl-ed-bloque", CATALOGOS.bloques); $("#ed-bloque").value = nombre; llenarAreasSegunBloque(); }
    if (clase === "area") { CATALOGOS.areas = [...(CATALOGOS.areas||[]), nombre]; llenarAreasSegunBloque(); $("#ed-area").value = nombre; }
    if (clase === "giro") { CATALOGOS.giros = [...(CATALOGOS.giros||[]), nombre]; llenarDatalist("#dl-ed-giro", CATALOGOS.giros); $("#ed-giro").value = nombre; }
  };
});

$("#btn-guardar-editar").onclick = async () => {
  const id = $("#ed-id").value;
  const contexto = $("#ed-contexto").value;
  const mundo = $("#ed-mundo").value;
  const cuerpo = {
    area: $("#ed-area").value, bloque: $("#ed-bloque").value, giro: $("#ed-giro").value,
    partida: $("#ed-partida").value, tipo_partida: $("#ed-tipo-partida").value,
    definido: $("#ed-definido").value, aplica: $("#ed-aplica").value,
    avance: parseInt($("#ed-avance").value || 0),
    f_inicio: $("#ed-inicio").value || null, f_fin: $("#ed-fin").value || null,
    duracion_dias: $("#ed-duracion").value || null, estatus: $("#ed-estatus").value,
    depende_de: $("#ed-depende").value || null, notas: $("#ed-notas").value,
    causa_retraso: $("#ed-causa").value || null, nota_proveedor: $("#ed-nota-prov").value || null,
    mundo,
  };
  if (mundo === "interno") {
    cuerpo.departamento = $("#ed-proveedor").value;
    cuerpo.tipo_interno = $("#ed-tipo-partida").value;
  } else {
    cuerpo.proveedor = $("#ed-proveedor").value;
  }
  const r = await (await fetch("/api/actividad/" + id, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })).json();
  if (r.error) { toast(r.error); return; }
  cerrarEditar();
  if (contexto === "noreco") {
    await fetch("/api/validacion/limpiar_no_reconocida/" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    toast("Corregida — vuelve como nueva para reconocer");
  } else {
    await fetch("/api/validacion/reactivar/" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    toast("Corregida y reactivada");
  }
  await cargar();
};

async function firmar(id) {
  await fetch("/api/validacion/aprobar/" + id, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  toast("Firmado ✓");
  await cargar();
}

function abrirModalRechazo(id) {
  $("#rechazo-id").value = id;
  $("#rechazo-motivo").value = "";
  $("#modal-rechazo").hidden = false;
  setTimeout(() => $("#rechazo-motivo").focus(), 50);
}

function cerrarModalRechazo() {
  $("#modal-rechazo").hidden = true;
}

$("#btn-cerrar-rechazo").onclick = cerrarModalRechazo;
$("#btn-cancelar-rechazo").onclick = cerrarModalRechazo;
$("#btn-confirmar-rechazo").onclick = async () => {
  const id = $("#rechazo-id").value;
  const motivo = $("#rechazo-motivo").value.trim();
  cerrarModalRechazo();
  await fetch("/api/validacion/rechazar/" + id, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo: motivo || "Rechazado por administración" })
  });
  toast("Rechazado");
  await cargar();
};

$("#btn-todos-av").addEventListener("click", async () => {
  if (!AVANCES.length) return;
  if (!confirm(`¿Firmar los ${AVANCES.length} avances reportados? El avance oficial tomará los valores reportados.`)) return;
  await fetch("/api/validacion/aprobar_todas", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: AVANCES.map(a => a.id) }),
  });
  toast("Avances firmados");
  await cargar();
});

// Inicializar buscador de atención si existe
const filtroAten = document.getElementById("filtro-atencion");
if (filtroAten) {
  filtroAten.addEventListener("input", () => renderAtencion());
}

// Filtro y agrupador de avances
const filtroAv = document.getElementById("filtro-av");
const agruparAv = document.getElementById("agrupar-av");
if (filtroAv) filtroAv.addEventListener("input", () => renderAvances());
if (agruparAv) agruparAv.addEventListener("change", () => renderAvances());

// Búsqueda global — filtra las 3 secciones a la vez
const busqGlobal = document.getElementById("busqueda-global");
if (busqGlobal) {
  busqGlobal.addEventListener("input", () => {
    const val = busqGlobal.value.trim();
    // Sincronizar con filtros locales
    if (filtroAv) filtroAv.value = val;
    const filtroAtenEl = document.getElementById("filtro-atencion");
    if (filtroAtenEl) filtroAtenEl.value = val;
    renderAvances();
    renderPropuestas();
    renderAtencion();
  });
}

// Panel detalle: cerrar
const overlayDet = document.getElementById("overlay-detalle");
const panelDet = document.getElementById("panel-detalle");
const btnCerrarDet = document.getElementById("btn-cerrar-detalle");
if (overlayDet) overlayDet.onclick = cerrarPanelDetalle;
if (btnCerrarDet) btnCerrarDet.onclick = cerrarPanelDetalle;

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  cerrarModalRechazo(); cerrarEditar(); cerrarPanelDetalle();
});

// Eliminar actividad desde el panel de editar de Validación
$("#btn-eliminar-editar").addEventListener("click", async () => {
  const id = $("#ed-id").value;
  const cod = $("#ed-codigo").textContent;
  if (!id) return;
  if (!confirm(`¿Eliminar la actividad ${cod}? Esta acción no se puede deshacer.`)) return;
  const r = await fetch("/api/actividad/" + id, { method: "DELETE" });
  if (r.ok) {
    cerrarEditar();
    toast("Actividad eliminada");
    await cargar();
  } else {
    toast("Error al eliminar");
  }
});

cargar();
