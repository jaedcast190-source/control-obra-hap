/* Service worker: solo se encarga de recibir notificaciones push y
   mostrarlas / abrir la plataforma al tocarlas. No cachea nada — así
   nunca puede dejar pegada una versión vieja de la plataforma. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evt) => {
  let datos = { titulo: "Control de Obra HAP", cuerpo: "Tienes un aviso nuevo.", url: "/" };
  try {
    if (evt.data) datos = { ...datos, ...evt.data.json() };
  } catch (e) { /* si no viene JSON, se usan los valores por defecto */ }

  evt.waitUntil(
    self.registration.showNotification(datos.titulo || "Control de Obra HAP", {
      body: datos.cuerpo || "",
      icon: "/static/icono-192.png",
      badge: "/static/icono-192.png",
      data: { url: datos.url || "/" },
      tag: "hap-aviso",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (evt) => {
  evt.notification.close();
  const url = (evt.notification.data && evt.notification.data.url) || "/";
  evt.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
