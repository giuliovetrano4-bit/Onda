// Herramientas de interfaz que usan todas las pantallas.

// Crea un elemento: h("button", { class: "x", onclick: fn }, "Texto", otroNodo)
// Los hijos null/false se ignoran y las listas se aplanan.
export function h(etiqueta, attrs = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // solo para nuestros iconos SVG
    else el.setAttribute(k, v === true ? "" : v);
  }
  // Si no hay hijos no tocamos el contenido, para no borrar el icono puesto con "html".
  if (hijos.length) poner(el, hijos);
  return el;
}

// Sustituye el contenido de un elemento, limpiando null/false y aplanando listas.
export function poner(el, hijos) {
  const limpios = [hijos].flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false);
  el.replaceChildren(...limpios);
}

// Iconos SVG propios (trazos sencillos).
const svg = (d, relleno = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" class="${relleno ? "relleno" : ""}">${d}</svg>`;
export const icono = {
  inicio: svg('<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  buscar: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'),
  biblioteca: svg('<path d="M5 4v16M10 4v16M15 5l4 15"/>'),
  ajustes: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>', true),
  pausa: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  siguiente: svg('<path d="M6 5v14l9-7zM17 5h2v14h-2z"/>', true),
  anterior: svg('<path d="M18 5v14l-9-7zM5 5h2v14H5z"/>', true),
  corazon: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  mas: svg('<path d="M12 5v14M5 12h14"/>'),
  abajo: svg('<path d="m6 9 6 6 6-6"/>'),
  volumen: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  onda: svg('<path d="M2 12c2.5-6 5-6 7 0s4.5 6 7 0 4.5-6 6 0"/>'),
  etiqueta: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>'),
  puntos: svg('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', true),
  aleatorio: svg('<path d="M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3.4-1.6 4.6-3.6M14 7.3c1-.2 2.1-.3 4-.3h3M18 4l3 3-3 3M18 14l3 3-3 3"/>'),
  expandir: svg('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
  nota: svg('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>')
};

// Muestra un aviso breve abajo.
let temporizador;
export function avisar(texto) {
  const el = document.getElementById("aviso");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(temporizador);
  temporizador = setTimeout(() => el.classList.remove("visible"), 2500);
}

// 125 segundos -> "2:05"
export function tiempo(seg) {
  seg = Math.max(0, Math.floor(seg || 0));
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

// Portada con un dibujo de nota si no hay imagen o si la imagen falla al cargar.
export function portada(cancion, clase = "portada") {
  const vacia = () => h("div", { class: clase + " vacia", html: icono.nota });
  if (!cancion.portada) return vacia();
  const img = h("img", { class: clase, src: cancion.portada, alt: "", loading: "lazy" });
  img.addEventListener("error", () => img.replaceWith(vacia()), { once: true });
  return img;
}

// Marca pequeña de la fuente de la canción: "YT" o "Libre".
export function marcaFuente(cancion) {
  const yt = cancion.fuente === "youtube";
  return h("span", { class: "marca" + (yt ? " yt" : ""), title: yt ? "YouTube" : "Música libre" }, yt ? "YT" : "Libre");
}

// ---------- Hoja inferior (menú que sale desde abajo) ----------
// Hay una sola hoja (#hoja en index.html); abrir otra sustituye su contenido.
const fondoHoja = document.getElementById("hoja-fondo");
export function abrirHoja(titulo, ...contenido) {
  poner(document.getElementById("hoja"), [h("div", { class: "hoja-asa" }), h("h3", {}, titulo), contenido]);
  fondoHoja.hidden = false;
}
export function cerrarHoja() { fondoHoja.hidden = true; }
export const hojaAbierta = () => !fondoHoja.hidden;

// Tocar fuera de la hoja la cierra. Solo cuenta si el toque empezó y acabó en el fondo;
// ese clic lo recibe el propio fondo, así que el clic siguiente funciona con normalidad.
let empezoFuera = false;
fondoHoja.addEventListener("pointerdown", (e) => { empezoFuera = e.target === fondoHoja; });
fondoHoja.addEventListener("click", (e) => { if (empezoFuera && e.target === fondoHoja) cerrarHoja(); });

// Hoja con un campo de texto (crear o renombrar). Intro confirma.
export function pedirTexto(titulo, valor, textoBoton, alAceptar) {
  const aceptar = () => {
    const v = campo.value.trim();
    if (!v) return campo.focus();
    cerrarHoja();
    alAceptar(v);
  };
  const campo = h("input", { class: "campo", value: valor, maxlength: "40", "aria-label": titulo,
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); aceptar(); } } });
  abrirHoja(titulo, h("div", { class: "fila-campo" }, campo,
    h("button", { class: "boton", type: "button", onclick: aceptar }, textoBoton)));
  campo.focus();
}
