/* Portal: vista del plano para el proveedor / departamento.
   Usa MIS, abrirReporte() y cargar() de portal.js (se carga después de portal.js). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const escP = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const OCULTAR_AL_VER_PLANO = [".p-aviso", ".p-controles", "#barra-reconocer", "#p-lista"];

  let VISOR = null, INFO = null, PINES = [], SEL = null, ABIERTO = false;

  async function iniciar() {
    try {
      INFO = await (await fetch("/api/plano/info")).json();
      if (INFO && INFO.existe) {
        const pines = await (await fetch("/api/plano/pines")).json();
        if (Array.isArray(pines) && pines.length) $("#btn-ver-plano").hidden = false;
      }
    } catch (e) { /* sin plano: el botón queda oculto */ }
  }

  function mostrarLista(v) {
    OCULTAR_AL_VER_PLANO.forEach(sel => { const el = document.querySelector(sel); if (el) el.style.display = v ? "" : "none"; });
    $("#p-plano-vista").hidden = v;
    document.body.classList.toggle("plano-abierto", !v);
    if (v && typeof render === "function") render();
  }

  async function abrirPlano() {
    ABIERTO = true;
    mostrarLista(false);
    cerrarTarjeta();
    try {
      if (!VISOR) {
        VISOR = new PlanoVisor($("#p-plano-vp"), { onPin: abrirTarjeta, onVacio: () => cerrarTarjeta() });
        await VISOR.cargarImagen("/api/plano/imagen?v=" + encodeURIComponent(INFO.version));
      }
      await recargarPines();
      VISOR.ajustarAPines();
    } catch (e) { $("#p-plano-vacio").hidden = false; }
  }

  async function recargarPines() {
    PINES = await (await fetch("/api/plano/pines")).json();
    if (!Array.isArray(PINES)) PINES = [];
    $("#p-plano-vacio").hidden = PINES.length > 0;
    VISOR.setPines(PINES);
    if (SEL) { const p = PINES.find(q => q.id === SEL); if (p) { VISOR.seleccionar(SEL); abrirTarjeta(p); } else cerrarTarjeta(); }
  }

  function abrirTarjeta(pin) {
    SEL = pin.id;
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
      boton;
    t.hidden = false;
    $("#pp-x").onclick = cerrarTarjeta;
    const br = $("#pp-reportar"); if (br) br.onclick = () => abrirReporte(pin.actividad_id);
    const bl = $("#pp-lista"); if (bl) bl.onclick = () => { cerrarPlano(); };
  }

  function cerrarTarjeta() {
    SEL = null;
    $("#p-plano-tarjeta").hidden = true;
    if (VISOR) VISOR.seleccionar(null);
  }

  function cerrarPlano() { ABIERTO = false; cerrarTarjeta(); mostrarLista(true); }

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
