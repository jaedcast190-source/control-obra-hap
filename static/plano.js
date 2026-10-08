/* Pantalla "Plano de obra" (admin edita; supervisor solo consulta) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let INFO = { existe: false, puede_editar: false, version: "0" };
  let VISOR = null;
  let PINES = [];
  let COLOCANDO = null;     // { actividad } cuando se está ubicando una actividad nueva
  let MOVIENDO = null;      // id del pin que se está reubicando
  let SEL = null;           // pin seleccionado
  let tBusca = null;
  let TAB = "colocar";      // pestaña activa: colocar | colocados | capas
  let REF_UBICAR = null;    // responsable cuyos pines se ven mientras se ubica (modo "solo al responsable")
  let CAPAS = [];           // [{ nombre, color, n, resps }] calculadas de los pines
  const VISTA = { color: "prov", agrupar: true, atenuar: false, activas: null };  // activas null = todas

  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2600); }

  async function api(url, opc) {
    const r = await fetch(url, opc);
    if (r.status === 401) { location.href = "/login"; throw new Error("login"); }
    let d = {}; try { d = await r.json(); } catch (e) { /* sin cuerpo */ }
    if (!r.ok) throw new Error(d.error || ("Error " + r.status));
    return d;
  }

  async function inicio() {
    try {
      const q = await (await fetch("/api/quien_soy")).json();
      if (!q.login) { location.href = "/login"; return; }
      if (["admin", "supervisor", "supervisor_obra", "supervisor_depto"].indexOf(q.rol) < 0) { location.href = "/portal"; return; }
      INFO = await api("/api/plano/info");
    } catch (e) { return; }

    document.querySelectorAll(".perm-editar").forEach(el => { el.hidden = !INFO.puede_editar; });
    if (!INFO.puede_editar) $("#pl-sub").textContent = "Consulta del plano (solo lectura)";
    $("#cp-verotros").checked = INFO.ver_otros !== false;

    VISOR = crearVisor();
    if (!INFO.existe) { mostrarSinPlano(); }
    else { await VISOR.cargarImagen("/api/plano/imagen?v=" + encodeURIComponent(INFO.version)); }
    pestana(INFO.puede_editar ? "colocar" : "colocados");
    await cargarPines();
    if (INFO.puede_editar) await buscarActividades();
    // viene del 📍 de la pantalla principal: /plano?actividad=ID
    const ida = Number(new URLSearchParams(location.search).get("actividad"));
    if (ida && INFO.existe) await irAActividad(ida);
  }

  // Con pin: lo muestra centrado. Sin pin: el admin queda listo para ubicarla (ya elegida).
  async function irAActividad(id) {
    const pines = PINES.filter(p => p.actividad_id === id);
    if (pines.length) {
      pestana("colocados");
      const pin = pines[0];
      VISOR.seleccionar(pin.id, true);
      abrirTarjeta(pin);
      if (pines.length > 1) toast("Esta actividad tiene " + pines.length + " pines en el plano");
      return;
    }
    if (!INFO.puede_editar) { toast("Esta actividad aún no tiene pin en el plano."); return; }
    try {
      const a = await api("/api/actividad/" + id);
      $("#pl-q").value = a.codigo || "";
      await buscarActividades();
      const lista = JSON.parse($("#pl-resultados").dataset.lista || "[]");
      const act = lista.find(x => x.id === id);
      if (act) empezarColocar(act); else toast("No encontré la actividad para ubicarla.");
    } catch (e) { toast(e.message); }
  }

  function crearVisor() {
    return new PlanoVisor($("#pl-vista"), { onPin: abrirTarjeta, onVacio: alTocarVacio, onCluster: abrirTarjetaZona, onPintado: pintarTag });
  }

  function mostrarSinPlano() {
    $("#pl-vista").innerHTML = '<div class="pl-sinplano"><h2>Aún no hay plano cargado</h2>' +
      (INFO.puede_editar ? '<p>Sube el PDF o la imagen del plano con el botón <b>⬆ Subir / cambiar plano</b> de arriba.</p>' : '<p>El administrador todavía no sube el plano.</p>') + '</div>';
  }

  // ---------- subir plano ----------
  $("#btn-subir-plano").addEventListener("click", () => $("#file-plano").click());
  $("#file-plano").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (INFO.existe && PINES.length && !confirm("Ya hay un plano con " + PINES.length + " pines. Si subes otro, los pines se quedan en la misma posición relativa. ¿Reemplazar el plano?")) return;
    const fd = new FormData(); fd.append("archivo", f);
    toast("Subiendo y preparando el plano… puede tardar unos segundos");
    try {
      const r = await api("/api/plano/subir", { method: "POST", body: fd });
      INFO = await api("/api/plano/info");
      if (!$("#pl-vista .plano-lienzo")) { VISOR = crearVisor(); }
      await VISOR.cargarImagen("/api/plano/imagen?v=" + encodeURIComponent(INFO.version));
      aplicarVista();
      toast("Plano cargado (" + r.kb + " KB)");
    } catch (err) { toast(err.message); }
  });

  // ---------- pestañas ----------
  function pestana(cual) {
    TAB = cual;
    ["colocar", "colocados", "capas"].forEach(k => $("#tab-" + k).classList.toggle("on", k === cual));
    $("#panel-colocar").hidden = cual !== "colocar" || !INFO.puede_editar;
    $("#panel-colocados").hidden = cual !== "colocados";
    $("#panel-capas").hidden = cual !== "capas";
    if (cual !== "colocar" && (COLOCANDO || MOVIENDO)) terminarModo();
    aplicarVista();
  }
  $("#tab-colocar").addEventListener("click", () => pestana("colocar"));
  $("#tab-colocados").addEventListener("click", () => { pestana("colocados"); renderPines(); });
  $("#tab-capas").addEventListener("click", () => { pestana("capas"); renderCapas(); });

  // ---------- capas y vista del plano ----------
  function respDe(a) { return ((a && (a.proveedor || a.departamento)) || "").trim(); }

  function calcularCapas() {
    const mapa = {};
    PINES.forEach(p => {
      const c = mapa[p.capa] || (mapa[p.capa] = { nombre: p.capa, color: p.color, n: 0, resps: new Set() });
      c.n++; c.resps.add(p.resp);
    });
    CAPAS = Object.keys(mapa).map(k => mapa[k]).sort((a, b) => (a.nombre === "Otros") - (b.nombre === "Otros") || b.n - a.n);
    if (VISTA.activas) { const ok = new Set(CAPAS.map(c => c.nombre)); VISTA.activas = new Set([...VISTA.activas].filter(x => ok.has(x))); }
  }
  function capaActiva(nombre) { return !VISTA.activas || VISTA.activas.has(nombre); }
  function nombreCapa(c) { return c.nombre === "Otros" ? "Otros (" + c.resps.size + ")" : c.nombre; }

  function renderCapas() {
    const max = Math.max.apply(null, CAPAS.map(c => c.n).concat([1]));
    $("#cp-lista").innerHTML = CAPAS.length ? CAPAS.map(c =>
      '<button type="button" class="cp-capa' + (capaActiva(c.nombre) ? "" : " off") + '" data-capa="' + esc(c.nombre) + '" style="--c:' + c.color + '">' +
      '<span class="pt"></span><span class="tx">' + esc(nombreCapa(c)) + '<small style="width:' + Math.round(c.n / max * 100) + '%"></small></span><span class="n">' + c.n + '</span></button>'
    ).join("") : '<p class="cp-ayuda">Aún no hay pines en el plano.</p>';
    $("#cp-color").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === VISTA.color));
    $("#cp-agrupar").checked = VISTA.agrupar; $("#cp-atenuar").checked = VISTA.atenuar;
  }
  $("#cp-lista").addEventListener("click", (e) => {
    const b = e.target.closest(".cp-capa"); if (!b) return;
    if (!VISTA.activas) VISTA.activas = new Set(CAPAS.map(c => c.nombre));
    const n = b.dataset.capa;
    if (VISTA.activas.has(n)) VISTA.activas.delete(n); else VISTA.activas.add(n);
    if (VISTA.activas.size === CAPAS.length) VISTA.activas = null;
    renderCapas(); aplicarVista();
  });
  $("#cp-todas").addEventListener("click", () => { VISTA.activas = null; renderCapas(); aplicarVista(); });
  $("#cp-ninguna").addEventListener("click", () => { VISTA.activas = new Set(); renderCapas(); aplicarVista(); });
  $("#cp-color").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; VISTA.color = b.dataset.m; renderCapas(); aplicarVista(); });
  $("#cp-agrupar").addEventListener("change", (e) => { VISTA.agrupar = e.target.checked; aplicarVista(); });
  $("#cp-atenuar").addEventListener("change", (e) => { VISTA.atenuar = e.target.checked; aplicarVista(); });
  $("#cp-verotros").addEventListener("change", async (e) => {
    try { await api("/api/plano/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ver_otros: e.target.checked }) });
      toast(e.target.checked ? "Los proveedores ya pueden ver a otros gremios (solo consulta)" : "Los proveedores solo verán sus propias actividades"); }
    catch (err) { e.target.checked = !e.target.checked; toast(err.message); }
  });

  let TAGINFO = null;
  function pintarTag(info) {
    const t = $("#pl-tag");
    if (!TAGINFO || !info) { t.hidden = true; return; }
    let txt = TAGINFO.texto;
    if (TAGINFO.tipo === "capas") {
      const todas = !VISTA.activas;
      if (todas) txt = VISTA.agrupar && info.burbujas ? "Vista general · " + PINES.length + " pines en " + info.burbujas + " zonas" : PINES.length + " pines";
      else txt = "Mostrando " + VISTA.activas.size + " de " + CAPAS.length + " capas · " + TAGINFO.visibles + " de " + PINES.length + " pines";
    }
    t.textContent = txt; t.hidden = !txt;
  }

  // Decide QUÉ pines se ven y CÓMO, según la pestaña:
  //  · Ubicar: solo lo del responsable de la actividad que estás colocando (puntos chicos), para que no se amontone.
  //  · Colocados / Capas: las capas elegidas, coloreadas por proveedor o por avance, con burbujas si hay muchos juntos.
  function aplicarVista() {
    if (!VISOR || !INFO.existe) return;
    let lista = [], agrupar = VISTA.agrupar;
    if (TAB === "colocar" && INFO.puede_editar) {
      const modo = $("#pl-vermodo").value;
      const ref = REF_UBICAR || $("#pl-prov").value || null;
      if (modo === "ninguno") { lista = []; TAGINFO = { tipo: "txt", texto: "Plano limpio · sin pines" }; agrupar = false; }
      else if (modo === "resp" && ref) {
        lista = PINES.filter(p => p.resp === ref).map(p => Object.assign({}, p, { _t: "punto", _c: p.color }));
        agrupar = false;
        TAGINFO = { tipo: "txt", texto: "Viendo " + lista.length + " pines de " + ref + " · cámbialo arriba" };
      } else {
        lista = PINES.map(p => Object.assign({}, p, { _t: "pin", _c: p.color, _n: "" }));
        agrupar = true;
        TAGINFO = { tipo: "txt", texto: modo === "resp" ? "Elige una actividad (o un Responsable) para ver solo sus pines" : "" };
      }
    } else {
      const av = VISTA.color === "avance";
      let visibles = 0;
      PINES.forEach(p => {
        const on = capaActiva(p.capa);
        if (!on && !VISTA.atenuar) return;
        if (on) visibles++;
        lista.push(Object.assign({}, p, { _t: on ? "pin" : "tenue", _c: on ? (av ? PlanoColorAvance(p.avance) : p.color) : p.color, _n: av ? (Number(p.avance) || 0) : "" }));
      });
      TAGINFO = { tipo: "capas", visibles: visibles };
    }
    VISOR.agrupar = agrupar;
    VISOR.setPines(lista);
  }
  $("#pl-vermodo").addEventListener("change", aplicarVista);

  // ---------- buscar actividades (igual que la pantalla principal) ----------
  let CAT = null;   // catálogos para los filtros (bloques, áreas por bloque, especialidades, responsables)

  // Cada lista tiene su ✕ rojo: aparece solo cuando hay algo elegido y lo quita de un toque.
  function marcarFiltros() {
    ["pl-bloque", "pl-area", "pl-giro", "pl-prov"].forEach(id => {
      const el = $("#" + id), x = document.querySelector('.pl-x[data-para="' + id + '"]');
      const hay = !!el.value;
      if (x) x.hidden = !hay;
      if (el.parentNode) el.parentNode.classList.toggle("con-valor", hay);
    });
  }
  function llenarSelect(id, titulo, valores, actual) {
    const el = $(id);
    el.innerHTML = '<option value="">' + titulo + '</option>' + valores.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join("");
    if (actual && valores.indexOf(actual) >= 0) el.value = actual;
    marcarFiltros();
  }
  function llenarFiltros(d) {
    CAT = d;
    llenarSelect("#pl-bloque", "Bloque", d.bloques, $("#pl-bloque").value);
    llenarAreas();
    llenarSelect("#pl-giro", "Especialidad", d.giros, $("#pl-giro").value);
    llenarSelect("#pl-prov", "Responsable", d.proveedores, $("#pl-prov").value);
  }
  function llenarAreas() {
    if (!CAT) return;
    const b = $("#pl-bloque").value;
    const lista = [...new Set(CAT.areas.filter(x => !b || x.bloque === b).map(x => x.area))];
    llenarSelect("#pl-area", "Área", lista, $("#pl-area").value);
  }

  async function buscarActividades() {
    const par = new URLSearchParams({
      q: $("#pl-q").value.trim(), bloque: $("#pl-bloque").value, area: $("#pl-area").value,
      giro: $("#pl-giro").value, proveedor: $("#pl-prov").value,
      solo_sin_pin: $("#pl-solo-sin").checked ? "1" : "0",
    });
    try {
      const d = await api("/api/plano/actividades?" + par.toString());
      if (!CAT) llenarFiltros(d);
      $("#pl-contador").textContent = d.total > d.actividades.length
        ? "Mostrando " + d.actividades.length + " de " + d.total
        : d.total + (d.total === 1 ? " actividad" : " actividades");
      let html = "", grupo = "";
      d.actividades.forEach(a => {
        const g = [a.bloque, a.area].filter(Boolean).join(" · ");
        if (g !== grupo) { grupo = g; html += '<div class="pl-grupo">' + esc(g || "Sin área") + '</div>'; }
        html += '<button type="button" class="pl-item' + (a.n_pines ? " con-pin" : "") + (COLOCANDO && COLOCANDO.id === a.id ? " activo" : "") + '" data-id="' + a.id + '">' +
          '<div class="i-cod">' + esc(a.codigo) + (a.n_pines ? '<span class="pl-badge">📍 ' + a.n_pines + '</span>' : '') + '<span class="i-av">' + (a.avance || 0) + '%</span></div>' +
          '<div class="i-par">' + esc(a.partida) + '</div>' +
          '<div class="i-met">' + esc([a.giro, a.proveedor || a.departamento].filter(Boolean).join(" · ")) + '</div></button>';
      });
      $("#pl-resultados").innerHTML = html || '<p class="pl-sinplano" style="padding:16px">Sin resultados.</p>';
      $("#pl-resultados").dataset.lista = JSON.stringify(d.actividades);
    } catch (e) { toast(e.message); }
  }
  $("#pl-q").addEventListener("input", () => { clearTimeout(tBusca); tBusca = setTimeout(buscarActividades, 250); });
  $("#pl-bloque").addEventListener("change", () => { $("#pl-area").value = ""; llenarAreas(); buscarActividades(); });
  ["#pl-area", "#pl-giro", "#pl-prov", "#pl-solo-sin"].forEach(id => $(id).addEventListener("change", buscarActividades));
  $("#pl-prov").addEventListener("change", () => { REF_UBICAR = null; aplicarVista(); });
  ["#pl-bloque", "#pl-area", "#pl-giro", "#pl-prov"].forEach(id => $(id).addEventListener("change", marcarFiltros));
  document.querySelectorAll(".pl-x").forEach(x => x.addEventListener("click", () => {
    const sel = $("#" + x.dataset.para);
    sel.value = "";
    sel.dispatchEvent(new Event("change"));   // dispara la misma búsqueda de siempre
  }));
  $("#pl-limpiar").addEventListener("click", () => {
    $("#pl-q").value = ""; ["#pl-bloque", "#pl-area", "#pl-giro", "#pl-prov"].forEach(id => $(id).value = "");
    $("#pl-solo-sin").checked = false; llenarAreas(); marcarFiltros(); buscarActividades();
  });
  $("#pl-resultados").addEventListener("click", (e) => {
    const b = e.target.closest(".pl-item"); if (!b) return;
    const lista = JSON.parse($("#pl-resultados").dataset.lista || "[]");
    const a = lista.find(x => x.id === Number(b.dataset.id));
    if (a) empezarColocar(a);
  });

  function esCelular() { return window.matchMedia && window.matchMedia("(max-width:760px)").matches; }
  function irAlMapa() { if (esCelular()) { try { document.querySelector(".pl-centro").scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* sin scroll */ } } }
  function irALaLista() { if (esCelular()) { try { document.querySelector("#pl-lado").scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* sin scroll */ } } }

  function empezarColocar(a) {
    if (!INFO.existe) { toast("Primero sube el plano."); return; }
    MOVIENDO = null; COLOCANDO = a;
    REF_UBICAR = respDe(a) || null;
    aplicarVista();
    VISOR.setModoColocar(true);
    cerrarTarjeta();
    $("#pl-banner-txt").textContent = "Toca en el plano dónde va: " + a.codigo + " · " + (a.partida || "").slice(0, 60);
    $("#pl-banner").hidden = false;
    document.querySelectorAll(".pl-item").forEach(el => el.classList.toggle("activo", Number(el.dataset.id) === a.id));
    irAlMapa();
  }
  function terminarModo() {
    COLOCANDO = null; MOVIENDO = null;
    if (VISOR) VISOR.setModoColocar(false);
    $("#pl-banner").hidden = true;
    document.querySelectorAll(".pl-item.activo").forEach(el => el.classList.remove("activo"));
  }
  $("#pl-banner-cancelar").addEventListener("click", terminarModo);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { terminarModo(); cerrarTarjeta(); } });

  async function alTocarVacio(f) {
    if (!INFO.puede_editar) { cerrarTarjeta(); return; }
    try {
      if (COLOCANDO) {
        const a = COLOCANDO;
        const r = await api("/api/plano/pines", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actividad_id: a.id, x: f.x, y: f.y }) });
        terminarModo();
        await cargarPines();
        VISOR.seleccionar(r.id);
        const pin = PINES.find(p => p.id === r.id);
        if (pin) abrirTarjeta(pin);
        toast("Pin colocado: " + a.codigo);
        buscarActividades();
        setTimeout(irALaLista, 900);
      } else if (MOVIENDO) {
        const id = MOVIENDO;
        await api("/api/plano/pines/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x: f.x, y: f.y }) });
        terminarModo();
        await cargarPines();
        VISOR.seleccionar(id);
        const pin = PINES.find(p => p.id === id);
        if (pin) abrirTarjeta(pin);
        toast("Pin movido");
      } else { cerrarTarjeta(); }
    } catch (err) { toast(err.message); }
  }

  // ---------- pines ----------
  async function cargarPines() {
    PINES = await api("/api/plano/pines");
    $("#n-colocados").textContent = PINES.length;
    calcularCapas(); renderCapas();
    aplicarVista();
    renderPines();
  }

  function renderPines() {
    const q = ($("#pl-qc").value || "").trim().toLowerCase();
    const lista = PINES.filter(p => !q || [p.codigo, p.partida, p.area, p.bloque, p.proveedor, p.departamento].join(" ").toLowerCase().indexOf(q) >= 0);
    $("#pl-pines").innerHTML = lista.length ? lista.map(p =>
      '<button type="button" class="pl-item' + (SEL === p.id ? " activo" : "") + '" data-pin="' + p.id + '">' +
      '<div class="i-cod">' + esc(p.codigo) + ' · ' + (p.avance || 0) + '%</div>' +
      '<div class="i-par">' + esc(p.partida) + '</div>' +
      '<div class="i-met">' + esc([p.bloque, p.area, p.proveedor || p.departamento].filter(Boolean).join(" · ")) + '</div></button>'
    ).join("") : '<p class="pl-sinplano" style="padding:16px">Aún no hay pines.</p>';
  }
  $("#pl-qc").addEventListener("input", renderPines);
  $("#pl-pines").addEventListener("click", (e) => {
    const b = e.target.closest(".pl-item"); if (!b) return;
    const pin = PINES.find(p => p.id === Number(b.dataset.pin));
    if (!pin) return;
    if (VISTA.activas && !VISTA.activas.has(pin.capa)) { VISTA.activas.add(pin.capa); renderCapas(); }
    aplicarVista();
    VISOR.seleccionar(pin.id, true);
    abrirTarjeta(pin);
    irAlMapa();
  });

  // ---------- tarjeta del pin ----------
  function abrirTarjeta(pin) {
    SEL = pin.id;
    const av = Number(pin.avance) || 0;
    const color = PlanoColorAvance(av);
    const enRev = pin.avance_decl != null && pin.avance_decl !== pin.avance;
    const t = $("#pl-tarjeta");
    t.style.setProperty("--c", color);
    t.innerHTML =
      '<button class="pt-cerrar" type="button" id="pt-x" title="Cerrar">✕</button>' +
      '<div class="pt-cod">' + esc(pin.codigo) + '</div>' +
      '<div class="pt-partida">' + esc(pin.partida) + '</div>' +
      '<div class="pt-meta">' + esc([pin.bloque, pin.area, pin.proveedor || pin.departamento].filter(Boolean).join(" · ")) + '</div>' +
      '<div class="pt-avance"><div class="pt-barra"><div style="width:' + av + '%"></div></div><span class="pt-pct">' + av + '%</span></div>' +
      (enRev ? '<div class="pt-rev">Reportado por el proveedor: ' + pin.avance_decl + '% · en revisión</div>' : '') +
      (INFO.puede_editar
        ? '<input class="pl-nota-in" id="pt-nota" maxlength="300" placeholder="Nota para el proveedor (opcional)" value="' + esc(pin.nota) + '">' +
          '<div class="pt-acciones"><button type="button" id="pt-guardar-nota" class="pt-pri">Guardar nota</button>' +
          '<button type="button" id="pt-mover">Mover</button><button type="button" id="pt-borrar" class="pt-peligro">Quitar pin</button></div>'
        : (pin.nota ? '<div class="pt-nota">' + esc(pin.nota) + '</div>' : ''));
    t.hidden = false;
    $("#pt-x").onclick = cerrarTarjeta;
    if (INFO.puede_editar) {
      $("#pt-guardar-nota").onclick = async () => {
        try { await api("/api/plano/pines/" + pin.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nota: $("#pt-nota").value }) });
          pin.nota = $("#pt-nota").value; toast("Nota guardada"); } catch (e) { toast(e.message); }
      };
      $("#pt-mover").onclick = () => {
        COLOCANDO = null; MOVIENDO = pin.id; VISOR.setModoColocar(true); cerrarTarjeta(true);
        if (TAB === "colocar") { REF_UBICAR = pin.resp; aplicarVista(); }
        $("#pl-banner-txt").textContent = "Toca el nuevo lugar de " + pin.codigo;
        $("#pl-banner").hidden = false;
      };
      $("#pt-borrar").onclick = async () => {
        if (!confirm("¿Quitar este pin del plano? La actividad NO se borra.")) return;
        try { await api("/api/plano/pines/" + pin.id, { method: "DELETE" }); cerrarTarjeta(); await cargarPines(); toast("Pin quitado"); buscarActividades(); } catch (e) { toast(e.message); }
      };
    }
    renderPines();
  }
  function abrirTarjetaZona(cl) {
    SEL = null;
    const res = PlanoResumenZona(cl.pines);
    const t = $("#pl-tarjeta");
    t.style.removeProperty("--c");
    t.innerHTML =
      '<button class="pt-cerrar" type="button" id="pt-x" title="Cerrar">✕</button>' +
      '<div class="pz-tit">Zona</div><div class="pz-zona">' + esc(res.zona) + ' · ' + res.total + ' actividades</div>' +
      PlanoBarrasZona(res) +
      '<div class="pz-lider">Más actividades en esta zona: <b>' + esc(res.lider) + '</b></div>' +
      (res.total <= 6 ? '<ul class="pz-lista">' + cl.pines.map(p => '<li><b>' + esc(p.codigo) + '</b> · ' + esc(p.partida) + ' · ' + (p.avance || 0) + '%</li>').join("") + '</ul>' : '') +
      '<div class="pt-acciones"><button type="button" class="pt-pri" id="pz-acercar">Acercar a esta zona</button></div>';
    t.hidden = false;
    $("#pt-x").onclick = () => cerrarTarjeta();
    $("#pz-acercar").onclick = () => { VISOR.acercarA(cl.pines); t.hidden = true; };
    renderPines();
  }
  function cerrarTarjeta(conservarSel) {
    $("#pl-tarjeta").hidden = true;
    if (!conservarSel) { SEL = null; if (VISOR) { VISOR.seleccionarCluster(null); VISOR.seleccionar(null); } renderPines(); }
  }

  inicio();
})();
