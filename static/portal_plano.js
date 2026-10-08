/* Portal: vista del plano para el proveedor / departamento.
   Usa MIS, abrirReporte() y cargar() de portal.js (se carga después de portal.js).
   - Sus actividades salen como pines con su avance (si hay muchas juntas, en burbujas).
   - "Ver otros gremios en mi zona": puntos pequeños de solo consulta (si el admin lo permite). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const escP = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const OCULTAR_AL_VER_PLANO = [".p-aviso", ".p-controles", "#barra-reconocer", "#p-lista"];
  const RADIO_ZONA = 0.05;   // "mi zona" = a menos del 5% del ancho del plano de alguno de mis pines
  const CLAVE_OTROS = "hap_plano_ver_otros";

  let VISOR = null, INFO = null, PINES = [], OTROS = { habilitado: false, pines: [] }, SEL = null, ABIERTO = false;
  let VER_OTROS = false;
  const ESTADOS = { listo: true, proceso: true, sin: true };   // qué pines míos se ven
  let CAPAS_ACT = null;                                         // null = todos los gremios
  let OTROS_ZONA = [];                                          // otros gremios dentro de mi zona

  function guardarPref(v) { try { localStorage.setItem(CLAVE_OTROS, v ? "1" : "0"); } catch (e) { /* sin almacenamiento */ } }
  function leerPref() { try { return localStorage.getItem(CLAVE_OTROS) === "1"; } catch (e) { return false; } }

  async function iniciar() {
    try {
      INFO = await (await fetch("/api/plano/info")).json();
      // El botón se muestra siempre que haya plano cargado; si el proveedor aún no tiene
      // pines, al abrirlo se le explica que la dirección todavía no ubica sus actividades.
      if (INFO && INFO.existe) $("#btn-ver-plano").hidden = false;
    } catch (e) { /* sin plano: el botón queda oculto */ }
  }

  function mostrarLista(v) {
    OCULTAR_AL_VER_PLANO.forEach(sel => { const el = document.querySelector(sel); if (el) el.style.display = v ? "" : "none"; });
    $("#p-plano-vista").hidden = v;
    document.body.classList.toggle("plano-abierto", !v);
    if (v && typeof render === "function") render();
  }

  function irArriba() { try { window.scrollTo(0, 0); } catch (e) { /* sin scroll */ } }

  async function abrirPlano() {
    ABIERTO = true;
    VER_OTROS = leerPref();
    mostrarLista(false);
    $("#p-plano-panel").classList.remove("abierto");
    irArriba();
    cerrarTarjeta();
    try {
      if (!VISOR) {
        VISOR = new PlanoVisor($("#p-plano-vp"), { onPin: abrirTarjeta, onVacio: () => cerrarTarjeta(), onCluster: abrirTarjetaZona });
        await VISOR.cargarImagen("/api/plano/imagen?v=" + encodeURIComponent(INFO.version));
      }
      await recargarPines();
      VISOR.ajustarAPines();
    } catch (e) { $("#p-plano-vacio").hidden = false; }
  }

  async function recargarPines() {
    PINES = await (await fetch("/api/plano/pines")).json();
    if (!Array.isArray(PINES)) PINES = [];
    try {
      const o = await (await fetch("/api/plano/otros")).json();
      OTROS = o && Array.isArray(o.pines) ? o : { habilitado: false, pines: [] };
    } catch (e) { OTROS = { habilitado: false, pines: [] }; }
    $("#p-plano-vacio").hidden = PINES.length > 0;
    $("#p-plano-vp").style.opacity = PINES.length ? "1" : ".55";
    calcularZona();
    pintar();
    renderPanel();
    if (SEL) { const p = PINES.find(q => q.id === SEL); if (p) { VISOR.seleccionar(SEL); abrirTarjeta(p); } else cerrarTarjeta(); }
  }

  function estadoDe(av) { av = Number(av) || 0; return av >= 100 ? "listo" : av > 0 ? "proceso" : "sin"; }

  // Otros gremios que están cerca de alguno de mis pines.
  function calcularZona() {
    OTROS_ZONA = [];
    if (!VISOR || !VISOR.imgW || !PINES.length || !OTROS.pines.length) return;
    OTROS_ZONA = OTROS.pines.filter(o => PINES.some(p => Math.hypot((p.x - o.x) * VISOR.imgW, (p.y - o.y) * VISOR.imgH) <= RADIO_ZONA * VISOR.imgW));
  }
  function otrosVisibles() { return VER_OTROS ? OTROS_ZONA.filter(o => !CAPAS_ACT || CAPAS_ACT.has(o.capa)) : []; }

  function pintar() {
    if (!VISOR) return;
    const lista = [];
    otrosVisibles().forEach(o => lista.push(Object.assign({}, o, { _otro: true, _t: "punto", _c: o.color, codigo: "", resp: o.resp })));
    PINES.forEach(p => {
      if (!ESTADOS[estadoDe(p.avance)]) return;
      lista.push(Object.assign({}, p, { _t: "pin", _c: PlanoColorAvance(p.avance), _n: Number(p.avance) || 0 }));
    });
    VISOR.agrupar = true;
    VISOR.setPines(lista);
  }

  // ---------- panel de capas ----------
  function renderPanel() {
    const cuenta = { listo: 0, proceso: 0, sin: 0 };
    PINES.forEach(p => cuenta[estadoDe(p.avance)]++);
    const filaMia = (k, txt, color) =>
      '<button type="button" class="cp-capa' + (ESTADOS[k] ? "" : " off") + '" data-est="' + k + '" style="--c:' + color + '"><span class="pt"></span><span class="tx">' + txt + '</span><span class="n">' + cuenta[k] + '</span></button>';
    let h = '<button type="button" class="cp-cerrar-movil" id="pp-cerrar-panel">Listo · ver el plano</button>' +
      '<div class="cp-tit">Mis actividades en el plano</div>';
    if (OTROS.habilitado && OTROS.pines.length && PINES.length) {
      h += '<label class="cp-sw"><input type="checkbox" id="pp-otros"' + (VER_OTROS ? " checked" : "") + '><span class="tg"></span>Ver otros gremios en mi zona</label>';
    }
    h += filaMia("listo", "Mis pines (listo)", "#1E7B4B") + filaMia("proceso", "Mis pines (en proceso)", "#D98E04") + filaMia("sin", "Mis pines (sin avance)", "#7a8591");
    if (VER_OTROS && OTROS.habilitado) {
      const por = {};
      OTROS_ZONA.forEach(o => { (por[o.capa] = por[o.capa] || { nombre: o.capa, color: o.color, n: 0, resps: new Set() }); por[o.capa].n++; por[o.capa].resps.add(o.resp); });
      const capas = Object.keys(por).map(k => por[k]).sort((a, b) => (a.nombre === "Otros") - (b.nombre === "Otros") || b.n - a.n);
      h += '<div class="cp-tit">Otros gremios (solo consulta)</div>';
      h += capas.length ? capas.map(c =>
        '<button type="button" class="cp-capa' + (!CAPAS_ACT || CAPAS_ACT.has(c.nombre) ? "" : " off") + '" data-capa="' + escP(c.nombre) + '" style="--c:' + c.color + '"><span class="pt"></span><span class="tx">' +
        escP(c.nombre === "Otros" ? "Otros (" + c.resps.size + ")" : c.nombre) + '</span><span class="n">' + c.n + '</span></button>').join("")
        : '<p class="cp-ayuda">No hay otros gremios cerca de tus actividades.</p>';
      h += '<p class="cp-ayuda">Los pines de otros gremios son puntos pequeños: solo ves quién trabaja ahí y su avance, no puedes modificarlos.</p>';
    } else if (PINES.length) {
      h += '<p class="cp-ayuda">Si hay muchas actividades juntas se agrupan en una burbuja con su número; acerca el plano o tócala para ver el detalle.</p>';
    }
    $("#p-plano-panel").innerHTML = h;
  }

  $("#p-plano-panel").addEventListener("click", (e) => {
    if (e.target.closest("#pp-cerrar-panel")) { $("#p-plano-panel").classList.remove("abierto"); return; }
    const b = e.target.closest(".cp-capa");
    if (!b) return;
    if (b.dataset.est) { ESTADOS[b.dataset.est] = !ESTADOS[b.dataset.est]; }
    else if (b.dataset.capa) {
      const todas = [...new Set(OTROS_ZONA.map(o => o.capa))];
      if (!CAPAS_ACT) CAPAS_ACT = new Set(todas);
      const n = b.dataset.capa;
      if (CAPAS_ACT.has(n)) CAPAS_ACT.delete(n); else CAPAS_ACT.add(n);
      if (CAPAS_ACT.size === todas.length) CAPAS_ACT = null;
    }
    pintar(); renderPanel();
  });
  $("#p-plano-panel").addEventListener("change", (e) => {
    if (e.target.id !== "pp-otros") return;
    VER_OTROS = e.target.checked; guardarPref(VER_OTROS);
    pintar(); renderPanel(); cerrarTarjeta();
  });
  $("#btn-plano-capas").addEventListener("click", () => $("#p-plano-panel").classList.toggle("abierto"));

  // ---------- tarjetas ----------
  function lineaZona(pin) {
    // "En esta zona tú tienes N actividades; CEBSA tiene M."
    if (!VISOR || !OTROS.habilitado || !OTROS.pines.length) return "";
    const mias = VISOR.pinesCerca(PINES, pin.x, pin.y, RADIO_ZONA).length;
    const otras = VISOR.pinesCerca(OTROS.pines, pin.x, pin.y, RADIO_ZONA);
    if (!otras.length) return "";
    if (pin._otro) {
      const deEl = otras.filter(o => o.resp === pin.resp).length;
      return '<div class="pz-lider">En esta zona tú tienes <b>' + mias + '</b> actividades; ' + escP(pin.resp) + ' tiene <b>' + deEl + '</b>.</div>';
    }
    const res = PlanoResumenZona(otras);
    return '<div class="pz-lider">Cerca de esta actividad: tú <b>' + mias + '</b>; ' + escP(res.lider) + ' <b>' + res.lider_n + '</b>.</div>';
  }

  function abrirTarjeta(pin) {
    SEL = pin.id;
    $("#p-plano-panel").classList.remove("abierto");
    if (pin._otro) { abrirTarjetaOtro(pin); return; }
    // datos al día desde MIS (incluye si ya la reconoció y si está al 100%)
    const a = (typeof MIS !== "undefined" ? MIS : []).find(x => x.id === pin.actividad_id) || {};
    const av = Number(a.avance != null ? a.avance : pin.avance) || 0;
    const decl = a.avance_decl != null ? a.avance_decl : pin.avance_decl;
    const enRev = decl != null && decl !== av;
    const sinReconocer = a.id ? (a.reconocida !== "SÍ" && a.estado_val !== "propuesta" && a.estado_val !== "rechazada") : false;
    const color = PlanoColorAvance(av);
    let boton = "";
    if (!a.id) boton = '<p class="pt-meta">Esta actividad no aparece en tu lista.</p>';
    else if (sinReconocer) boton = '<div class="pt-acciones"><button type="button" id="pp-lista">Ir a mi lista para reconocerla</button></div>';
    else if (a.tipo_interno === "Validación") boton = '<div class="pt-acciones"><button type="button" id="pp-lista">Ir a mi lista (prueba de funcionamiento)</button></div>';
    else if (av >= 100 && !enRev) boton = '<p class="pt-meta">✅ Completado al 100%</p>';
    else boton = '<div class="pt-acciones"><button type="button" class="pt-pri" id="pp-reportar">Reportar avance</button></div>';
    const t = $("#p-plano-tarjeta");
    t.style.setProperty("--c", color);
    t.innerHTML =
      '<button class="pt-cerrar" type="button" id="pp-x" title="Cerrar">✕</button>' +
      '<div class="pt-cod">' + escP(pin.codigo) + '</div>' +
      '<div class="pt-partida">' + escP(pin.partida) + '</div>' +
      '<div class="pt-meta">' + escP([pin.bloque, pin.area].filter(Boolean).join(" · ")) + '</div>' +
      (pin.nota ? '<div class="pt-nota">' + escP(pin.nota) + '</div>' : '') +
      '<div class="pt-avance"><div class="pt-barra"><div style="width:' + av + '%"></div></div><span class="pt-pct">' + av + '%</span></div>' +
      (enRev ? '<div class="pt-rev">Reportaste ' + decl + '% · en revisión</div>' : '') +
      (VER_OTROS ? lineaZona(pin) : '') +
      boton;
    t.hidden = false;
    $("#pp-x").onclick = cerrarTarjeta;
    const br = $("#pp-reportar"); if (br) br.onclick = () => abrirReporte(pin.actividad_id);
    const bl = $("#pp-lista"); if (bl) bl.onclick = () => { cerrarPlano(); };
  }

  // Pin de otro gremio: solo consulta, sin botón de reportar.
  function abrirTarjetaOtro(pin) {
    const av = Number(pin.avance) || 0;
    const t = $("#p-plano-tarjeta");
    t.style.setProperty("--c", PlanoColorAvance(av));
    t.innerHTML =
      '<button class="pt-cerrar" type="button" id="pp-x" title="Cerrar">✕</button>' +
      '<div class="pz-tit">Otro gremio · solo consulta</div>' +
      '<div class="pt-partida">' + escP(pin.partida) + '</div>' +
      '<div class="pt-meta">' + escP([pin.resp, pin.bloque, pin.area].filter(Boolean).join(" · ")) + '</div>' +
      '<div class="pt-avance"><div class="pt-barra"><div style="width:' + av + '%"></div></div><span class="pt-pct">' + av + '%</span></div>' +
      lineaZona(pin);
    t.hidden = false;
    $("#pp-x").onclick = cerrarTarjeta;
  }

  // Burbuja: cuántas actividades hay juntas y de quién (mías + otros gremios cercanos si están a la vista).
  function abrirTarjetaZona(cl) {
    SEL = null;
    $("#p-plano-panel").classList.remove("abierto");
    const propios = cl.pines.filter(p => !p._otro);
    const cuenta = { listo: 0, proceso: 0, sin: 0 };
    propios.forEach(p => cuenta[estadoDe(p.avance)]++);
    let cx = 0, cy = 0; cl.pines.forEach(p => { cx += p.x; cy += p.y; }); cx /= cl.pines.length; cy /= cl.pines.length;
    const mezcla = propios.map(p => Object.assign({}, p, { capa: "Tú", resp: "Tú", color: "#1E7B4B" }));
    if (VER_OTROS) VISOR.pinesCerca(otrosVisibles(), cx, cy, 0.025).forEach(o => mezcla.push(o));
    const res = PlanoResumenZona(mezcla);
    const t = $("#p-plano-tarjeta");
    t.style.removeProperty("--c");
    t.innerHTML =
      '<button class="pt-cerrar" type="button" id="pp-x" title="Cerrar">✕</button>' +
      '<div class="pz-tit">Zona</div><div class="pz-zona">' + escP(res.zona) + ' · ' + res.total + ' actividades</div>' +
      PlanoBarrasZona(res) +
      '<div class="pz-lider">' + (res.lider === "Tú" ? 'En esta zona <b>tú</b> tienes más actividades.' : 'Más actividades en esta zona: <b>' + escP(res.lider) + '</b>') + '</div>' +
      '<div class="pt-meta" style="margin:4px 0 0">Tuyas aquí: ' + cuenta.listo + ' listas · ' + cuenta.proceso + ' en proceso · ' + cuenta.sin + ' sin avance</div>' +
      '<div class="pt-acciones"><button type="button" class="pt-pri" id="pz-acercar">Acercar a esta zona</button></div>';
    t.hidden = false;
    $("#pp-x").onclick = cerrarTarjeta;
    $("#pz-acercar").onclick = () => { VISOR.acercarA(cl.pines); t.hidden = true; };
  }

  function cerrarTarjeta() {
    SEL = null;
    $("#p-plano-tarjeta").hidden = true;
    if (VISOR) { VISOR.seleccionarCluster(null); VISOR.seleccionar(null); }
  }

  function cerrarPlano() { ABIERTO = false; cerrarTarjeta(); $("#p-plano-panel").classList.remove("abierto"); mostrarLista(true); irArriba(); }

  // Al guardar un reporte, portal.js vuelve a cargar MIS: refrescamos pines y tarjeta.
  const cargarOriginal = window.cargar;
  if (typeof cargarOriginal === "function") {
    window.cargar = async function () {
      const r = await cargarOriginal.apply(this, arguments);
      if (ABIERTO && VISOR) { try { await recargarPines(); } catch (e) { /* ignorar */ } }
      return r;
    };
  }

  $("#btn-ver-plano").addEventListener("click", abrirPlano);
  $("#btn-plano-volver").addEventListener("click", cerrarPlano);
  iniciar();
})();
