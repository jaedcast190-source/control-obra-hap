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
    if (!this.imgW || !this.pines.length) { this.ajustar(); return; }
    const xs = this.pines.map(p => p.x), ys = this.pines.map(p => p.y);
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

  PlanoVisor.prototype.setPines = function (lista) {
    this.pines = lista || [];
    this._pintarPines();
  };

  PlanoVisor.prototype._pintarPines = function () {
    const self = this;
    this.capa.innerHTML = this.pines.map(function (p) {
      const av = Number(p.avance) || 0;
      const enRev = p.avance_decl != null && p.avance_decl !== p.avance;
      const sel = self.seleccion === p.id ? " sel" : "";
      return '<button type="button" class="plano-pin' + sel + (enRev ? " en-rev" : "") + '" data-pin="' + p.id + '" ' +
        'style="left:' + (p.x * 100) + '%;top:' + (p.y * 100) + '%;--c:' + colorAvance(av) + '" ' +
        'title="' + esc((p.codigo || "") + " · " + (p.partida || "") + " · " + av + "%") + '">' +
        '<span class="plano-pin-n">' + av + '</span></button>';
    }).join("");
  };

  PlanoVisor.prototype.seleccionar = function (id, centrar) {
    this.seleccion = id;
    this._pintarPines();
    if (centrar) {
      const p = this.pines.find(function (q) { return q.id === id; });
      if (p) this.centrarEn(p.x, p.y, this.minEscala * 2.2);
    }
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
        const pinEl = inicio.objetivo && inicio.objetivo.closest ? inicio.objetivo.closest(".plano-pin") : null;
        if (pinEl && !self.modoColocar) {
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
      if (self.modoColocar || e.target.closest(".plano-pin") || e.target.closest(".plano-zoom")) return;
      const r = cont.getBoundingClientRect();
      self.zoomEn(2, e.clientX - r.left, e.clientY - r.top);
    });

    window.addEventListener("resize", function () { if (self.imgW) { self._limitar(); self._aplicar(); } });
  };

  window.PlanoVisor = PlanoVisor;
  window.PlanoColorAvance = colorAvance;
})();
