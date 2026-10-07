/* =====================================================================
   Visor de plano con pines (compartido: pantalla del admin y portal del proveedor)
   - Arrastrar para mover, rueda / pellizco para acercar, doble clic para acercar.
   - Los pines guardan su posición como fracción (0..1) del plano, así que
     siguen en su lugar aunque cambie el tamaño de la pantalla.
   Uso:
     const visor = new PlanoVisor(contenedor, { onPin(pin){}, onVacio({x,y}){} });
     visor.cargarImagen(url); visor.setPines(lista); visor.seleccionar(id);
   ===================================================================== */
(function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function colorAvance(av) {
    av = Number(av) || 0;
    if (av >= 100) return "#1E7B4B";   // listo
    if (av > 0) return "#D98E04";      // en proceso
    return "#7a8591";                  // pendiente
  }

  function PlanoVisor(contenedor, opciones) {
    if (!contenedor) throw new Error("PlanoVisor: falta el contenedor");
    this.opc = opciones || {};
    this.cont = contenedor;
    this.escala = 1; this.tx = 0; this.ty = 0;
    this.minEscala = 0.1; this.maxEscala = 12;
    this.pines = []; this.seleccion = null;
    this.modoColocar = false;
    this.agrupar = false;          // true = pines cercanos se funden en burbujas con número
    this.clusters = [];            // burbujas visibles ahora: { id, x, y, pines }
    this.seleccionCluster = null;
    this._escalaPintada = 0; this._rafPintar = 0;
    this.imgW = 0; this.imgH = 0;
    this._punteros = new Map();
    this._construir();
    this._enlazar();
  }

  PlanoVisor.prototype._construir = function () {
    this.cont.classList.add("plano-vp");
    this.cont.innerHTML =
      '<div class="plano-lienzo"><img class="plano-img" alt="Plano de obra" draggable="false">' +
      '<div class="plano-capa"></div></div>' +
      '<div class="plano-cargando">Cargando plano…</div>' +
      '<div class="plano-zoom">' +
      '<button type="button" data-z="in" title="Acercar">+</button>' +
      '<button type="button" data-z="out" title="Alejar">−</button>' +
      '<button type="button" data-z="pines" title="Ir a mis pines">◎</button>' +
      '<button type="button" data-z="fit" title="Ver todo el plano">⤢</button></div>';
    this.lienzo = this.cont.querySelector(".plano-lienzo");
    this.img = this.cont.querySelector(".plano-img");
    this.capa = this.cont.querySelector(".plano-capa");
    this.cargandoEl = this.cont.querySelector(".plano-cargando");
  };

  PlanoVisor.prototype.cargarImagen = function (url) {
    const self = this;
    return new Promise(function (ok, fallo) {
      self.cargandoEl.hidden = false;
      self.cargandoEl.textContent = "Cargando plano…";
      self.img.onload = function () {
        self.imgW = self.img.naturalWidth; self.imgH = self.img.naturalHeight;
        self.lienzo.style.width = self.imgW + "px";
        self.lienzo.style.height = self.imgH + "px";
        self.cargandoEl.hidden = true;
        self.ajustar();
        ok();
      };
      self.img.onerror = function () {
        self.cargandoEl.hidden = false;
        self.cargandoEl.textContent = "No se pudo cargar el plano.";
        fallo(new Error("imagen"));
      };
      self.img.src = url;
    });
  };

  PlanoVisor.prototype._aplicar = function () {
    this.lienzo.style.transform = "translate(" + this.tx + "px," + this.ty + "px) scale(" + this.escala + ")";
    this.cont.style.setProperty("--inv", String(1 / this.escala));
    if (this.agrupar && this.pines.length && Math.abs(this.escala - this._escalaPintada) > 1e-6) {
      const self = this;
      if (!this._rafPintar) this._rafPintar = requestAnimationFrame(function () { self._rafPintar = 0; self.seleccionCluster = null; self._pintarPines(); });
    }
  };

  // Mantiene el plano dentro de la vista (no se puede "perder" fuera de pantalla).
  PlanoVisor.prototype._limitar = function () {
    const cw = this.cont.clientWidth, ch = this.cont.clientHeight;
    const w = this.imgW * this.escala, h = this.imgH * this.escala;
    const margen = 80;
    this.tx = w <= cw ? (cw - w) / 2 : Math.min(margen, Math.max(cw - w - margen, this.tx));
    this.ty = h <= ch ? (ch - h) / 2 : Math.min(margen, Math.max(ch - h - margen, this.ty));
  };

  PlanoVisor.prototype.ajustar = function () {
    if (!this.imgW) return;
    const cw = this.cont.clientWidth || 800, ch = this.cont.clientHeight || 500;
    this.escala = Math.min(cw / this.imgW, ch / this.imgH);
    this.minEscala = this.escala * 0.9;
    this.tx = 0; this.ty = 0;
    this._limitar(); this._aplicar();
  };

  // Encuadra todos los pines (con margen). Si no hay pines, muestra el plano completo.
  PlanoVisor.prototype.ajustarAPines = function () {
    // encuadra lo propio: ignora pines ajenos (solo consulta) y los atenuados
    let propios = this.pines.filter(p => !p._otro && p._t !== "tenue");
    if (!propios.length) propios = this.pines;
    if (!this.imgW || !propios.length) { this.ajustar(); return; }
    const xs = propios.map(p => p.x), ys = propios.map(p => p.y);
    let x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const cw = this.cont.clientWidth || 800, ch = this.cont.clientHeight || 500;
    const bw = Math.max(x1 - x0, 0.10) * 1.35, bh = Math.max(y1 - y0, 0.10) * 1.55;
    const esc = Math.min(cw / (bw * this.imgW), ch / (bh * this.imgH));
    const base = Math.min(cw / this.imgW, ch / this.imgH);
    this.escala = Math.min(this.maxEscala, Math.max(base, esc));
    this.tx = cw / 2 - ((x0 + x1) / 2) * this.imgW * this.escala;
    this.ty = ch / 2 - ((y0 + y1) / 2) * this.imgH * this.escala;
    this._limitar(); this._aplicar();
  };

  PlanoVisor.prototype.zoomEn = function (factor, cx, cy) {
    const cw = this.cont.clientWidth, ch = this.cont.clientHeight;
    if (cx == null) { cx = cw / 2; cy = ch / 2; }
    const nueva = Math.min(this.maxEscala, Math.max(this.minEscala, this.escala * factor));
    const k = nueva / this.escala;
    this.tx = cx - (cx - this.tx) * k;
    this.ty = cy - (cy - this.ty) * k;
    this.escala = nueva;
    this._limitar(); this._aplicar();
  };

  PlanoVisor.prototype.centrarEn = function (x, y, escalaMin) {
    const cw = this.cont.clientWidth, ch = this.cont.clientHeight;
    if (escalaMin && this.escala < escalaMin) this.escala = Math.min(this.maxEscala, escalaMin);
    this.tx = cw / 2 - x * this.imgW * this.escala;
    this.ty = ch / 2 - y * this.imgH * this.escala;
    this._limitar(); this._aplicar();
  };

  // Cada pin puede traer: _c (color), _t ('pin' gota | 'punto' chico | 'tenue' casi invisible) y
  // _n (texto dentro de la gota; por defecto el % de avance).
  PlanoVisor.prototype.setPines = function (lista) {
    this.pines = lista || [];
    this._pintarPines();
  };

  PlanoVisor.prototype.setAgrupar = function (v) {
    this.agrupar = !!v;
    this._pintarPines();
  };

  // Agrupa en burbujas los pines que quedan a menos de `radio` píxeles de pantalla.
  PlanoVisor.prototype._agrupar = function (lista) {
    const radio = 46, esc = this.escala, W = this.imgW, H = this.imgH;
    const libres = [], grupos = [];
    lista.forEach(function (p) {
      if (p._t === "punto" || p._t === "tenue") grupos.push({ pines: [p], x: p.x, y: p.y, solo: true });
      else libres.push(p);
    });
    const usado = new Set();
    for (let i = 0; i < libres.length; i++) {
      const a = libres[i];
      if (usado.has(a.id)) continue;
      usado.add(a.id);
      if (this.seleccion === a.id) { grupos.push({ pines: [a], x: a.x, y: a.y, solo: true }); continue; }
      const g = [a];
      for (let j = i + 1; j < libres.length; j++) {
        const b = libres[j];
        if (usado.has(b.id) || this.seleccion === b.id) continue;
        if (Math.hypot((a.x - b.x) * W * esc, (a.y - b.y) * H * esc) < radio) { g.push(b); usado.add(b.id); }
      }
      if (g.length === 1) { grupos.push({ pines: g, x: a.x, y: a.y, solo: true }); continue; }
      let sx = 0, sy = 0; g.forEach(function (q) { sx += q.x; sy += q.y; });
      grupos.push({ pines: g, x: sx / g.length, y: sy / g.length, solo: false });
    }
    // segunda pasada: burbujas que quedan casi encimadas entre sí se funden en una sola
    const dist = function (a, b) { return Math.hypot((a.x - b.x) * W * esc, (a.y - b.y) * H * esc); };
    let cambio = true;
    while (cambio) {
      cambio = false;
      const bur = grupos.filter(function (g) { return !g.solo; });
      for (let i = 0; i < bur.length && !cambio; i++) {
        for (let j = i + 1; j < bur.length && !cambio; j++) {
          if (dist(bur[i], bur[j]) < radio) {
            const a = bur[i], b = bur[j];
            a.pines = a.pines.concat(b.pines);
            let sx = 0, sy = 0; a.pines.forEach(function (q) { sx += q.x; sy += q.y; });
            a.x = sx / a.pines.length; a.y = sy / a.pines.length;
            grupos.splice(grupos.indexOf(b), 1);
            cambio = true;
          }
        }
      }
    }
    return grupos;
  };

  PlanoVisor.prototype._pintarPines = function () {
    const self = this;
    this._escalaPintada = this.escala;
    const grupos = this.agrupar && this.imgW
      ? this._agrupar(this.pines)
      : this.pines.map(function (p) { return { pines: [p], x: p.x, y: p.y, solo: true }; });
    this.clusters = [];
    let html = "", nBurbujas = 0;
    // primero lo tenue (queda debajo), luego puntos, pines y burbujas
    const orden = { tenue: 0, punto: 1, pin: 2 };
    grupos.sort(function (a, b) {
      const ta = a.solo ? orden[a.pines[0]._t || "pin"] : 3, tb = b.solo ? orden[b.pines[0]._t || "pin"] : 3;
      return ta - tb;
    });
    grupos.forEach(function (g) {
      if (!g.solo) {
        const idx = self.clusters.length;
        self.clusters.push({ idx: idx, x: g.x, y: g.y, pines: g.pines });
        nBurbujas++;
        const n = g.pines.length;
        const tam = Math.min(64, 30 + Math.round(Math.sqrt(n) * 7));
        const sel = self.seleccionCluster === idx ? " sel" : "";
        html += '<button type="button" class="plano-cl' + sel + '" data-cl="' + idx + '" ' +
          'style="left:' + (g.x * 100) + '%;top:' + (g.y * 100) + '%;--c:' + colorGrupo(g.pines) + ';--s:' + tam + 'px" ' +
          'title="' + n + ' actividades juntas · toca para ver el detalle"><span>' + n + '</span></button>';
        return;
      }
      const p = g.pines[0];
      const av = Number(p.avance) || 0;
      const color = p._c || colorAvance(av);
      const tipo = p._t || "pin";
      const tit = esc((p.codigo ? p.codigo + " · " : "") + (p.partida || "") + " · " + av + "%");
      if (tipo === "punto" || tipo === "tenue") {
        html += '<button type="button" class="plano-pt' + (tipo === "tenue" ? " tenue" : "") + (self.seleccion === p.id ? " sel" : "") + '" data-pin="' + p.id + '" ' +
          'style="left:' + (p.x * 100) + '%;top:' + (p.y * 100) + '%;--c:' + color + '" title="' + tit + '"></button>';
        return;
      }
      const enRev = p.avance_decl != null && p.avance_decl !== p.avance;
      const sel = self.seleccion === p.id ? " sel" : "";
      const txt = p._n != null ? p._n : av;
      html += '<button type="button" class="plano-pin' + sel + (enRev ? " en-rev" : "") + '" data-pin="' + p.id + '" ' +
        'style="left:' + (p.x * 100) + '%;top:' + (p.y * 100) + '%;--c:' + color + '" title="' + tit + '">' +
        '<span class="plano-pin-n">' + esc(txt) + '</span></button>';
    });
    this.capa.innerHTML = html;
    if (this.opc.onPintado) this.opc.onPintado({ pines: this.pines.length, burbujas: nBurbujas });
  };

  function colorGrupo(pines) {
    // Si todos comparten color (mismo gremio) la burbuja lo usa; si no, gris azulado neutro.
    const cs = pines.map(function (p) { return p._c || colorAvance(p.avance); });
    const c0 = cs[0];
    if (cs.every(function (c) { return c === c0; })) return c0;
    const cuenta = {}; cs.forEach(function (c) { cuenta[c] = (cuenta[c] || 0) + 1; });
    let mejor = c0, n = 0;
    Object.keys(cuenta).forEach(function (c) { if (cuenta[c] > n) { n = cuenta[c]; mejor = c; } });
    return mejor;   // el color que domina en esa zona
  }

  PlanoVisor.prototype.seleccionar = function (id, centrar) {
    this.seleccion = id;
    this.seleccionCluster = null;
    this._pintarPines();
    if (centrar) {
      const p = this.pines.find(function (q) { return q.id === id; });
      if (p) { this.centrarEn(p.x, p.y, this.minEscala * 2.2); this._pintarPines(); }
    }
  };

  PlanoVisor.prototype.seleccionarCluster = function (idx) {
    this.seleccionCluster = idx;
    this._pintarPines();
  };

  // Acerca la vista para que quepan estos pines (y las burbujas se separen).
  PlanoVisor.prototype.acercarA = function (pines) {
    if (!pines || !pines.length || !this.imgW) return;
    const xs = pines.map(function (p) { return p.x; }), ys = pines.map(function (p) { return p.y; });
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const cw = this.cont.clientWidth || 800, ch = this.cont.clientHeight || 500;
    const bw = Math.max(x1 - x0, 0.02) * 1.5, bh = Math.max(y1 - y0, 0.02) * 1.7;
    const ajuste = Math.min(cw / (bw * this.imgW), ch / (bh * this.imgH));
    this.escala = Math.min(this.maxEscala, Math.max(this.escala * 1.8, ajuste));
    this.centrarEn((x0 + x1) / 2, (y0 + y1) / 2);
    this._pintarPines();
  };

  PlanoVisor.prototype.setModoColocar = function (activo) {
    this.modoColocar = !!activo;
    this.cont.classList.toggle("plano-colocando", this.modoColocar);
  };

  PlanoVisor.prototype._fraccionDesdeEvento = function (e) {
    const r = this.cont.getBoundingClientRect();
    const px = (e.clientX - r.left - this.tx) / this.escala;
    const py = (e.clientY - r.top - this.ty) / this.escala;
    const x = px / this.imgW, y = py / this.imgH;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: x, y: y };
  };

  PlanoVisor.prototype._enlazar = function () {
    const self = this, cont = this.cont;

    cont.addEventListener("wheel", function (e) {
      e.preventDefault();
      const r = cont.getBoundingClientRect();
      self.zoomEn(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    cont.querySelector(".plano-zoom").addEventListener("click", function (e) {
      const b = e.target.closest("button"); if (!b) return;
      e.stopPropagation();
      if (b.dataset.z === "in") self.zoomEn(1.5);
      else if (b.dataset.z === "out") self.zoomEn(1 / 1.5);
      else if (b.dataset.z === "pines") self.ajustarAPines();
      else self.ajustar();
    });

    let movido = false, inicio = null, distIni = 0, escIni = 1;
    cont.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".plano-zoom")) return;
      cont.setPointerCapture(e.pointerId);
      self._punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (self._punteros.size === 1) { movido = false; inicio = { x: e.clientX, y: e.clientY, tx: self.tx, ty: self.ty, objetivo: e.target }; }
      if (self._punteros.size === 2) {
        const [a, b] = Array.from(self._punteros.values());
        distIni = Math.hypot(a.x - b.x, a.y - b.y); escIni = self.escala; movido = true;
      }
    });
    cont.addEventListener("pointermove", function (e) {
      if (!self._punteros.has(e.pointerId)) return;
      self._punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (self._punteros.size === 2) {
        const [a, b] = Array.from(self._punteros.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distIni > 0) {
          const r = cont.getBoundingClientRect();
          const objetivo = Math.min(self.maxEscala, Math.max(self.minEscala, escIni * d / distIni));
          self.zoomEn(objetivo / self.escala, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        }
      } else if (inicio) {
        const dx = e.clientX - inicio.x, dy = e.clientY - inicio.y;
        if (!movido && Math.hypot(dx, dy) > 6) { movido = true; cont.classList.add("plano-arrastrando"); }
        if (movido) { self.tx = inicio.tx + dx; self.ty = inicio.ty + dy; self._limitar(); self._aplicar(); }
      }
    });
    function soltar(e) {
      const estaba = self._punteros.has(e.pointerId);
      self._punteros.delete(e.pointerId);
      cont.classList.remove("plano-arrastrando");
      if (!estaba) return;
      if (self._punteros.size === 0 && inicio && !movido && e.type === "pointerup") {
        // toque simple: ¿sobre un pin o sobre el plano vacío?
        const clEl = inicio.objetivo && inicio.objetivo.closest ? inicio.objetivo.closest(".plano-cl") : null;
        const pinEl = inicio.objetivo && inicio.objetivo.closest ? inicio.objetivo.closest(".plano-pin,.plano-pt") : null;
        if (clEl && !self.modoColocar) {
          const cl = self.clusters[Number(clEl.dataset.cl)];
          if (cl) { self.seleccion = null; self.seleccionarCluster(cl.idx); if (self.opc.onCluster) self.opc.onCluster(cl); }
        } else if (pinEl && !self.modoColocar) {
          const id = Number(pinEl.dataset.pin);
          const pin = self.pines.find(function (q) { return q.id === id; });
          if (pin) { self.seleccionar(id); if (self.opc.onPin) self.opc.onPin(pin); }
        } else {
          const f = self._fraccionDesdeEvento(e);
          if (f && self.opc.onVacio) self.opc.onVacio(f);
        }
      }
      if (self._punteros.size === 0) inicio = null;
      else if (self._punteros.size === 1) {
        const [p] = Array.from(self._punteros.values());
        inicio = { x: p.x, y: p.y, tx: self.tx, ty: self.ty }; movido = true;
      }
    }
    cont.addEventListener("pointerup", soltar);
    cont.addEventListener("pointercancel", soltar);

    cont.addEventListener("dblclick", function (e) {
      if (self.modoColocar || e.target.closest(".plano-pin,.plano-pt,.plano-cl") || e.target.closest(".plano-zoom")) return;
      const r = cont.getBoundingClientRect();
      self.zoomEn(2, e.clientX - r.left, e.clientY - r.top);
    });

    window.addEventListener("resize", function () { if (self.imgW) { self._limitar(); self._aplicar(); } });
  };

  // Resumen de una zona: cuántas actividades tiene cada gremio (para la tarjeta de la burbuja).
  function resumenZona(pines) {
    const porCapa = {}, porResp = {}, areas = {}, bloques = {};
    pines.forEach(function (p) {
      const c = p.capa || p.resp || "—";
      (porCapa[c] = porCapa[c] || { nombre: c, color: p.color || "#8b949e", n: 0 }).n++;
      const r = p.resp || c; porResp[r] = (porResp[r] || 0) + 1;
      const a = [p.bloque, p.area].filter(Boolean).join(" · ") || "Sin área"; areas[a] = (areas[a] || 0) + 1;
      const bl = p.bloque || "Sin bloque"; bloques[bl] = (bloques[bl] || 0) + 1;
    });
    const capas = Object.keys(porCapa).map(function (k) { return porCapa[k]; }).sort(function (a, b) { return b.n - a.n; });
    const resps = Object.keys(porResp).sort(function (a, b) { return porResp[b] - porResp[a]; });
    const nomAreas = Object.keys(areas).sort(function (a, b) { return areas[b] - areas[a]; });
    const nomBloques = Object.keys(bloques).sort(function (a, b) { return bloques[b] - bloques[a]; });
    let zona = "";
    if (nomAreas.length === 1) zona = nomAreas[0];
    else if (nomAreas.length === 2) zona = nomAreas[0] + " y " + nomAreas[1];
    else if (nomAreas.length > 2) zona = nomBloques[0] + " · " + nomAreas.length + " áreas";
    return { total: pines.length, capas: capas, lider: resps[0] || "", lider_n: resps.length ? porResp[resps[0]] : 0, zona: zona, porResp: porResp };
  }

  // HTML de las barras por gremio (tarjeta de zona).
  function htmlBarrasZona(res) {
    const max = res.capas.length ? res.capas[0].n : 1;
    return res.capas.map(function (c) {
      return '<div class="pz-fila"><i style="background:' + c.color + '"></i><span class="pz-nom">' + esc(c.nombre) + '</span>' +
        '<span class="pz-barra"><em style="width:' + Math.round(c.n / max * 100) + '%;background:' + c.color + '"></em></span><b>' + c.n + '</b></div>';
    }).join("");
  }

  // Pines (de una lista) a menos de `radioFrac` del ancho del plano de un punto.
  PlanoVisor.prototype.pinesCerca = function (lista, x, y, radioFrac) {
    const W = this.imgW || 1, H = this.imgH || 1, r = radioFrac * W;
    return lista.filter(function (p) { return Math.hypot((p.x - x) * W, (p.y - y) * H) <= r; });
  };

  window.PlanoVisor = PlanoVisor;
  window.PlanoResumenZona = resumenZona;
  window.PlanoBarrasZona = htmlBarrasZona;
  window.PlanoColorAvance = colorAvance;
})();
