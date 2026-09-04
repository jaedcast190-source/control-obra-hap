/* === BLINDAJE v1.4 (2 sep 2026) — método seguro ===
   Si un id no existe en el HTML, $ devuelve un elemento suelto (no visible)
   en vez de null. Así el script NO se muere y el resto de la pantalla
   sigue funcionando. No se modifica ninguna otra línea del código. */
const $ = (s) => document.querySelector(s) || document.createElement("span");
const $$ = (s) => document.querySelectorAll(s);
let MIS = [];
let ZONA_ACTS = [];
let SOLO_NUEVAS = false;
let MAPA_BA = {}; // bloque -> [áreas] del propio proveedor
let BLOQUES_PROPIOS = null; // para interno: bloques donde ya tiene trabajo

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;setTimeout(()=>t.hidden=true,2200);}

async function inicio() {
  const q = await (await fetch("/api/quien_soy")).json();
  if (!q.login) { location.href = "/login"; return; }
  if (q.rol === "admin") { location.href = "/"; return; }
  $("#titulo-prov").textContent = q.proveedor || "Mi avance";
  await cargar();
}

async function cargar() {
  MIS = await (await fetch("/api/portal/mis_actividades")).json();
  // mapa bloque->áreas: externo solo lo suyo; interno todo el mapa de la obra
  try {
    const m = await (await fetch("/api/portal/mapa")).json();
    MAPA_BA = m.mapa || {};
    BLOQUES_PROPIOS = m.bloques_propios; // null para externo; lista para interno
  } catch(e) {
    MAPA_BA = {};
    MIS.forEach(a => { if (a.bloque && a.area) { (MAPA_BA[a.bloque]=MAPA_BA[a.bloque]||[]); if(!MAPA_BA[a.bloque].includes(a.area)) MAPA_BA[a.bloque].push(a.area); } });
  }
  const bloques = Object.keys(MAPA_BA).sort();
  $("#dl-p-bloque").innerHTML = bloques.map(b=>`<option value="${esc(b)}">`).join("");
  filtrarAreasNueva();
  // menú de filtro por bloque (arriba) = solo los bloques donde el usuario TIENE actividades
  const bloquesConTrabajo = [...new Set(MIS.map(a=>a.bloque).filter(Boolean))].sort();
  const selB = $("#p-bloque");
  const actual = selB.value;
  selB.innerHTML = `<option value="">Todos los bloques</option>` +
    bloquesConTrabajo.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join("");
  if (actual) selB.value = actual;
  llenarAreas();
  render();
  actualizarBotonNuevas();
}

// candado estricto en 'agregar actividad': el área solo muestra las del bloque elegido
function filtrarAreasNueva() {
  const b = $("#new-bloque").value;
  const areas = (b && MAPA_BA[b]) ? MAPA_BA[b] : [];
  $("#dl-p-area").innerHTML = areas.map(a=>`<option value="${esc(a)}">`).join("");
  const areaActual = $("#new-area").value;
  if (areaActual && b && !areas.includes(areaActual)) $("#new-area").value = "";
}

function llenarAreas() {
  const b = $("#p-bloque").value;
  const selA = $("#p-area");
  const actual = selA.value;
  const areas = [...new Set(MIS.filter(a=>!b || a.bloque===b).map(a=>a.area).filter(Boolean))].sort();
  selA.innerHTML = `<option value="">Todas las áreas</option>` +
    areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join("");
  if (actual && areas.includes(actual)) selA.value = actual;
}

function sinAcentos(s){return String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}

function render() {
  const q = sinAcentos($("#p-buscar").value || "");
  const fb = $("#p-bloque").value;
  const fa = $("#p-area").value;
  let lista = MIS.filter(a =>
    (!fb || a.bloque===fb) && (!fa || a.area===fa) &&
    (!q || sinAcentos(a.partida).includes(q) || sinAcentos(a.area).includes(q) || sinAcentos(a.bloque).includes(q) || sinAcentos(a.codigo).includes(q)));
  if (SOLO_NUEVAS) {
    lista = lista.filter(a => a.reconocida !== "SÍ" && a.estado_val !== "propuesta" && a.estado_val !== "rechazada");
  }
  // barra en modo nuevas: SIEMPRE visible mientras se esté en ese modo,
  // para que el proveedor pueda regresar aunque ya no queden nuevas por reconocer.
  const barraReco = $("#barra-reconocer");
  if (barraReco) barraReco.hidden = !SOLO_NUEVAS;
  // el botón de "reconocer todo" solo tiene sentido si hay algo que reconocer
  const btnRecoLoteEl = $("#btn-reconocer-lote");
  if (btnRecoLoteEl) btnRecoLoteEl.hidden = !(SOLO_NUEVAS && lista.length > 0);
  // texto guía cuando ya no quedan nuevas
  const brTextoEl = document.querySelector(".br-texto");
  if (brTextoEl) brTextoEl.textContent = (SOLO_NUEVAS && lista.length === 0)
    ? "Ya reconociste todo. Puedes volver a ver todas tus actividades."
    : "Estas son las actividades que te asignaron y aún no reconoces. Confirma que son tu trabajo para poder reportar avance.";
  $("#p-contador").textContent = lista.length + " actividades";
  const cont = $("#p-lista");
  if (!lista.length) { cont.innerHTML = `<p class="vacio">No hay actividades.</p>`; return; }
  cont.innerHTML = lista.map(a => {
    const av = a.avance || 0;
    const decl = a.avance_decl;
    const enRevision = decl != null && decl !== av;
    const sinReconocer = a.reconocida !== "SÍ" && a.estado_val !== "propuesta" && a.estado_val !== "rechazada";
    let estado = "";
    if (a.estado_val === "propuesta") estado = `<span class="p-tag p-prop">Esperando validación</span>`;
    else if (a.estado_val === "rechazada") estado = `<span class="p-tag p-rech">Propuesta rechazada</span>`;
    else if (sinReconocer) estado = `<span class="p-tag p-nueva">Nueva · por reconocer</span>`;
    else if (enRevision) estado = `<span class="p-tag p-rev">Reportado: ${decl}% · en revisión</span>`;
    else estado = `<span class="p-tag p-val">Validado: ${av}%</span>`;
    const origen = a.origen === "propuesta" ? `<span class="p-origen">nueva</span>` : "";
    
    // Alerta de rechazo si el admin rechazó el avance declarado
    let rechazoAlerta = "";
    if (a.avance_decl_rechazado || (a.estado_val === "rechazada" && a.rechazo_motivo)) {
      rechazoAlerta = `
        <div class="p-alerta-rechazo">
          <b>⚠️ Reporte rechazado por administración</b>
          "${esc(a.rechazo_motivo || 'Favor de verificar avance')}" 
          <span style="font-size:11px; opacity:.85;">— ${esc(a.rechazado_por||'Admin')} (${esc(a.rechazado_fecha||'')})</span>
        </div>`;
    }

    // Indicador de dependencias
    let depBadge = "";
    if (a.dep_bloqueada) {
      depBadge = `<div class="p-dep-badge p-dep-bloqueada" title="${esc(a.dep_detalle||'')}">🔒 ${esc(a.dep_estado)}</div>`;
    } else if (a.dep_estado && a.dep_estado !== "Sin dependencias") {
      depBadge = `<div class="p-dep-badge p-dep-liberada">🔓 ${esc(a.dep_estado)}</div>`;
    }

    // botón según estado
    let boton = "";
    if (sinReconocer) {
      boton = `<div class="p-reco-botones">
        <button class="p-reconocer" data-id="${a.id}">✓ Sí es mi trabajo</button>
        <button class="p-norecon" data-id="${a.id}">No lo reconozco</button>
      </div>`;
    } else {
      boton = `<button class="p-reportar" data-id="${a.id}">Reportar avance</button>`;
    }

    return `<div class="p-card ${a.estado_val} ${sinReconocer?'sin-reconocer':''}" data-id="${a.id}">
      <div class="p-card-top">
        <span class="p-cod">${esc(a.codigo||"")}</span>
        ${origen}
        ${estado}
      </div>
      <div class="p-card-bloque">${esc(a.bloque||"")}</div>
      <div class="p-card-area">${esc(a.area||"")}</div>
      <div class="p-card-part">${esc(a.partida||"")}</div>
      ${depBadge}
      ${rechazoAlerta}
      ${sinReconocer ? "" : `<div class="p-barra"><div class="p-barra-fill" style="width:${enRevision?decl:av}%"></div></div>`}
      ${boton}
    </div>`;
  }).join("");
  $$(".p-reportar").forEach(b =>
    b.addEventListener("click", () => abrirReporte(b.dataset.id)));
  $$(".p-reconocer").forEach(b =>
    b.addEventListener("click", () => reconocer(b.dataset.id)));
  $$(".p-norecon").forEach(b =>
    b.addEventListener("click", () => noReconozco(b.dataset.id)));
}

// ---- Reportar avance ----
function abrirReporte(id) {
  const a = MIS.find(x => x.id == id);
  if (!a) return;
  $("#rep-id").value = a.id;
  $("#rep-bloque").textContent = a.bloque || "—";
  $("#rep-area").textContent = a.area || "";
  $("#rep-partida").textContent = a.partida || "";
  const av = a.avance_decl != null ? a.avance_decl : (a.avance || 0);
  $("#rep-avance").value = av;
  marcarBoton("#rep-botones", av);
  $("#rep-inicio").value = a.f_inicio || "";
  $("#rep-fin").value = a.f_fin || "";
  $("#rep-definido-por").value = a.definido_por || "";
  $("#rep-nota").value = a.nota_proveedor || "";
  abrir("#ov-rep", "#panel-rep");
}

function marcarBoton(cont, v) {
  $$(cont + " button").forEach(b =>
    b.classList.toggle("sel", parseInt(b.dataset.v) === parseInt(v)));
}

$$("#rep-botones button").forEach(b =>
  b.addEventListener("click", () => {
    $("#rep-avance").value = b.dataset.v;
    marcarBoton("#rep-botones", b.dataset.v);
  }));

async function guardarReporte() {
  const id = $("#rep-id").value;
  const cuerpo = {
    avance_decl: parseInt($("#rep-avance").value || 0),
    f_inicio: $("#rep-inicio").value || null,
    f_fin: $("#rep-fin").value || null,
    definido: (parseInt($("#rep-avance").value||0) > 0 || $("#rep-definido-por").value) ? "SÍ" : "NO",
    definido_por: $("#rep-definido-por").value || null,
    nota_proveedor: $("#rep-nota").value || null,
  };
  await fetch("/api/portal/reportar_avance/" + id, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  cerrar("#ov-rep", "#panel-rep");
  toast("Avance enviado al ingeniero");
  await cargar();
}

// ---- Proponer actividad nueva ----
$$("#new-botones button").forEach(b =>
  b.addEventListener("click", () => {
    $("#new-avance").value = b.dataset.v;
    marcarBoton("#new-botones", b.dataset.v);
  }));

async function enviarNueva() {
  const partida = $("#new-partida").value.trim();
  if (!partida) { toast("Escribe qué actividad es"); return; }
  const cuerpo = {
    bloque: $("#new-bloque").value || null,
    area: $("#new-area").value || null,
    partida,
    avance_decl: parseInt($("#new-avance").value || 0),
    definido_por: $("#new-definido-por").value || null,
    nota_proveedor: $("#new-nota").value || null,
  };
  const r = await (await fetch("/api/portal/nueva", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  })).json();
  if (r.error) { toast(r.error); return; }
  cerrar("#ov-new", "#panel-new");
  ["#new-bloque","#new-area","#new-partida","#new-nota"].forEach(s=>$(s).value="");
  $("#new-avance").value = 0; marcarBoton("#new-botones", 0);
  $("#new-definido-por").value = "";
  toast("Actividad enviada para revisión");
  await cargar();
}

// ---- Reconocimiento de actividades ----
async function reconocer(id) {
  await fetch("/api/portal/reconocer/" + id, { method: "POST", headers: {"Content-Type":"application/json"}, body: "{}" });
  toast("Actividad reconocida ✓");
  await cargar();
}

async function noReconozco(id) {
  const nota = prompt("¿Por qué no reconoces esta actividad? (opcional)\nEsto le llega al ingeniero para corregir.");
  if (nota === null) return;
  await fetch("/api/portal/no_reconozco/" + id, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ nota: nota || "" }),
  });
  toast("Se avisó al ingeniero");
  await cargar();
}

async function reconocerBloque() {
  const b = $("#p-bloque").value;
  const texto = b ? `todas las actividades nuevas del bloque "${b}"` : "TODAS tus actividades nuevas";
  if (!confirm(`¿Reconoces ${texto}? Confirmas que ese trabajo es tuyo.`)) return;
  const r = await (await fetch("/api/portal/reconocer_bloque", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ bloque: b || null }),
  })).json();
  toast(`${r.reconocidas} actividades reconocidas`);
  await cargar();
}

async function actualizarBotonNuevas() {
  const r = await (await fetch("/api/portal/pendientes_reconocer")).json();
  const btn = $("#btn-nuevas");
  if (!btn) return;
  if (r.pendientes > 0) {
    btn.textContent = `🔔 Nuevas asignadas (${r.pendientes})`;
    btn.classList.add("con-nuevas");
    btn.disabled = false;
  } else {
    btn.textContent = "Sin nuevas";
    btn.classList.remove("con-nuevas");
    btn.disabled = true;
  }
}

// ---- Vista de Avance de Zona (Solo lectura) ----
async function abrirZona() {
  const m = $("#modal-zona");
  if (m) {
    m.hidden = false;
    m.style.display = "flex";
  }
  try {
    const res = await (await fetch("/api/portal/avance_zona")).json();
    ZONA_ACTS = res.actividades || [];
    const bDisp = res.bloques_disponibles || [];
    $("#zona-filtro-bloque").innerHTML = `<option value="">Todos los bloques de tu zona</option>` +
      bDisp.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
    renderZona();
  } catch(e) {
    toast("Error cargando avance de la zona");
  }
}

function cerrarZona() {
  const m = $("#modal-zona");
  if (m) {
    m.hidden = true;
    m.style.display = "none";
  }
}

function renderZona() {
  const bFiltro = $("#zona-filtro-bloque").value;
  const q = sinAcentos($("#zona-buscar").value || "");
  const filas = ZONA_ACTS.filter(a => {
    return (!bFiltro || a.bloque === bFiltro) &&
      (!q || sinAcentos(a.partida).includes(q) || sinAcentos(a.area).includes(q) || sinAcentos(a.proveedor||a.departamento||"").includes(q) || sinAcentos(a.giro||"").includes(q));
  });
  
  $("#vacio-zona").hidden = filas.length > 0;
  const tb = $("#tbody-zona");
  tb.innerHTML = filas.map(a => {
    const provOdepto = a.departamento || a.proveedor || "—";
    const av = a.avance || 0;
    const est = a.estatus || "Pendiente";
    let estClase = "b-pendiente";
    if (av >= 100) estClase = "b-listo";
    else if (av > 0) estClase = "b-proceso";
    
    return `
      <tr>
        <td><b>${esc(a.bloque||"—")}</b></td>
        <td>${esc(a.area||"—")}</td>
        <td><span class="giro-tag">${esc(provOdepto)}</span> <small style="color:#8a94a3;">(${esc(a.giro||a.tipo_partida||"")})</small></td>
        <td>${esc(a.partida||"—")}</td>
        <td style="font-weight:700; color:#1F4E78;">${av}%</td>
        <td><span class="badge ${estClase}">${esc(est)}</span></td>
        <td style="font-size:11.5px; color:#6b7280;">${esc(a.f_inicio||"")}${a.f_fin ? " → " + esc(a.f_fin) : ""}</td>
      </tr>
    `;
  }).join("");
}

$("#btn-zona").onclick = abrirZona;
$("#btn-cerrar-zona").onclick = cerrarZona;
$("#modal-zona").onclick = (e) => {
  if (e.target.id === "modal-zona") cerrarZona();
};
$("#zona-filtro-bloque").onchange = renderZona;
$("#zona-buscar").oninput = renderZona;

// ---- Cambio de Contraseña ----
function abrirCambiarClave() {
  $("#clave-actual").value = "";
  $("#clave-nueva").value = "";
  $("#clave-confirmar").value = "";
  const m = $("#modal-clave");
  if (m) {
    m.hidden = false;
    m.style.display = "flex";
  }
  setTimeout(() => $("#clave-actual").focus(), 50);
}

function cerrarCambiarClave() {
  const m = $("#modal-clave");
  if (m) {
    m.hidden = true;
    m.style.display = "none";
  }
}

async function guardarNuevaClave() {
  const actual = $("#clave-actual").value;
  const nueva = $("#clave-nueva").value;
  const conf = $("#clave-confirmar").value;
  if (!actual || !nueva) { toast("Llena los campos"); return; }
  if (nueva !== conf) { toast("La confirmación de contraseña no coincide"); return; }
  if (nueva.length < 4) { toast("La contraseña debe tener al menos 4 caracteres"); return; }
  
  const r = await (await fetch("/api/cambiar_mi_clave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clave_actual: actual, clave_nueva: nueva })
  })).json();
  
  if (r.ok) {
    toast("Contraseña actualizada exitosamente");
    cerrarCambiarClave();
  } else {
    toast(r.error || "Error al actualizar contraseña");
  }
}

$("#btn-cambiar-clave").onclick = abrirCambiarClave;
$("#btn-cerrar-clave").onclick = cerrarCambiarClave;
$("#btn-cancelar-clave").onclick = cerrarCambiarClave;
$("#modal-clave").onclick = (e) => {
  if (e.target.id === "modal-clave") cerrarCambiarClave();
};
$("#btn-guardar-clave").onclick = guardarNuevaClave;

// ---- Utilitarios de panel ----
function abrir(ov, pn) {
  const o = $(ov), p = $(pn);
  if (o) { o.hidden = false; o.style.display = "block"; }
  if (p) { p.hidden = false; p.style.display = "flex"; }
}

function cerrar(ov, pn) {
  const o = $(ov), p = $(pn);
  if (o) { o.hidden = true; o.style.display = "none"; }
  if (p) { p.hidden = true; p.style.display = "none"; }
}

function abrirNuevaActividad() {
  filtrarAreasNueva();
  abrir("#ov-new", "#panel-new");
}

async function cerrarSesion() {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch(e) {}
  location.href = "/login";
}

$("#rep-cerrar").addEventListener("click", () => cerrar("#ov-rep", "#panel-rep"));
$("#rep-cancelar").addEventListener("click", () => cerrar("#ov-rep", "#panel-rep"));
$("#ov-rep").addEventListener("click", () => cerrar("#ov-rep", "#panel-rep"));
$("#rep-guardar").addEventListener("click", guardarReporte);

$("#btn-nueva-p").addEventListener("click", abrirNuevaActividad);
$("#new-cerrar").addEventListener("click", () => cerrar("#ov-new", "#panel-new"));
$("#new-cancelar").addEventListener("click", () => cerrar("#ov-new", "#panel-new"));
$("#ov-new").addEventListener("click", () => cerrar("#ov-new", "#panel-new"));
$("#new-enviar").addEventListener("click", enviarNueva);
$("#new-bloque").addEventListener("change", filtrarAreasNueva);
$("#new-bloque").addEventListener("input", filtrarAreasNueva);

$("#p-buscar").addEventListener("input", render);
$("#p-bloque").addEventListener("change", () => { llenarAreas(); render(); });
$("#p-area").addEventListener("change", render);
$("#btn-nuevas").addEventListener("click", () => {
  SOLO_NUEVAS = true;
  $("#p-buscar").value = "";
  render();
});
const btnRecoLote = $("#btn-reconocer-lote");
if (btnRecoLote) btnRecoLote.addEventListener("click", reconocerBloque);
const btnVerTodo = $("#btn-ver-todo");
if (btnVerTodo) btnVerTodo.addEventListener("click", () => { SOLO_NUEVAS = false; render(); });
$("#btn-salir").addEventListener("click", cerrarSesion);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrar("#ov-rep", "#panel-rep");
    cerrar("#ov-new", "#panel-new");
    cerrarZona();
    cerrarCambiarClave();
  }
});

// Exponer en window para enlaces/botones inline
window.abrirNuevaActividad = abrirNuevaActividad;
window.abrirCambiarClave = abrirCambiarClave;
window.cerrarCambiarClave = cerrarCambiarClave;
window.guardarNuevaClave = guardarNuevaClave;
window.abrirZona = abrirZona;
window.cerrarZona = cerrarZona;
window.cerrarSesion = cerrarSesion;
window.cerrar = cerrar;
window.abrir = abrir;
window.guardarReporte = guardarReporte;
window.enviarNueva = enviarNueva;

// Cerrar todos los paneles y modales al arrancar
cerrar("#ov-rep", "#panel-rep");
cerrar("#ov-new", "#panel-new");
cerrarZona();
cerrarCambiarClave();

// Botón X para limpiar campos del formulario 'agregar actividad'
ponerBotonX("#new-bloque", () => {
  $("#new-area").value = "";
  filtrarAreasNueva();
});
ponerBotonX("#new-area");

inicio();
