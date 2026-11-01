// Punto de entrada: navegación por hash, mini reproductor y reproductor grande.

import { h, poner, icono, portada, tiempo, avisar, marcaFuente, cerrarHoja, hojaAbierta } from "./ui.js";
import * as pantallas from "./pantallas.js";
import { rep, alCambiar, alternar, siguiente, anterior, irA, ponerVolumen, irAIndice } from "./reproductor.js";
import { leer, guardar, alCambiarDatos } from "./almacen.js";

const $ = (id) => document.getElementById(id);

// ---------- Navegación sin recargar (#/inicio, #/lista/abc...) ----------
// "seccion" indica qué pestaña de abajo se marca en las pantallas sin pestaña propia.
const RUTAS = {
  inicio: { titulo: "Inicio", pintar: pantallas.inicio, tab: true },
  buscar: { titulo: "Buscar", pintar: pantallas.buscar, tab: true },
  biblioteca: { titulo: "Biblioteca", pintar: pantallas.biblioteca, tab: true },
  lista: { titulo: "Lista", pintar: pantallas.lista, seccion: "biblioteca" },
  etiqueta: { titulo: "Etiqueta", pintar: pantallas.etiqueta, seccion: "biblioteca" },
  ajustes: { titulo: "Ajustes", pintar: pantallas.ajustes }
};

// "#/lista/abc" -> { nombre: "lista", param: "abc" }
function rutaActual() {
  const [nombre, param = ""] = location.hash.replace("#/", "").split("/");
  return RUTAS[nombre] ? { nombre, param: decodeURIComponent(param) } : { nombre: "inicio", param: "" };
}
const pintarPantalla = () => {
  const { nombre, param } = rutaActual();
  poner($("app"), RUTAS[nombre].pintar(param));
};

function navegar() {
  const { nombre } = rutaActual();
  const ruta = RUTAS[nombre];
  const activa = ruta.seccion || nombre;
  cerrarHoja();
  $("titulo-pantalla").textContent = ruta.titulo;
  pintarPantalla();
  // Barra inferior: marcamos la sección activa.
  poner($("tabbar"), Object.entries(RUTAS).filter(([, r]) => r.tab).map(([id, r]) =>
    h("a", { href: "#/" + id, class: "tab" + (id === activa ? " activa" : ""),
      "aria-current": id === activa ? "page" : null },
      h("span", { html: icono[id] }), h("span", {}, r.titulo))));
  window.scrollTo(0, 0);
}

$("btn-ajustes").innerHTML = icono.ajustes;
window.addEventListener("hashchange", navegar);
navegar();

// Si cambian listas, favoritas o etiquetas: corazones al día y repintar la pantalla
// si muestra listas (sin volver arriba). Buscar no se repinta para no perder el texto.
alCambiarDatos(() => {
  pantallas.refrescarCorazones();
  if (["inicio", "biblioteca", "lista", "etiqueta"].includes(rutaActual().nombre)) pintarPantalla();
});

// ---------- Barra de progreso arrastrable (funciona con ratón y dedo) ----------
function barraProgreso() {
  const relleno = h("div", { class: "pista-llena" });
  const bola = h("div", { class: "bola" });
  const barra = h("div", { class: "barra", role: "slider", "aria-label": "Posición", tabindex: "0" },
    h("div", { class: "pista" }, relleno), bola);
  let arrastrando = false;

  const fraccionDe = (e) => {
    const r = barra.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const dibujar = (f) => { relleno.style.width = f * 100 + "%"; bola.style.left = f * 100 + "%"; };

  // Eventos de puntero: valen igual para ratón, dedo y lápiz.
  barra.addEventListener("pointerdown", (e) => {
    arrastrando = true;
    barra.setPointerCapture(e.pointerId);
    dibujar(fraccionDe(e));
  });
  barra.addEventListener("pointermove", (e) => { if (arrastrando) dibujar(fraccionDe(e)); });
  const soltar = (e) => {
    if (!arrastrando) return;
    arrastrando = false;
    const dur = rep.fuente ? rep.fuente.duracion() : 0;
    if (dur) irA(fraccionDe(e) * dur);
  };
  barra.addEventListener("pointerup", soltar);
  barra.addEventListener("pointercancel", () => { arrastrando = false; });
  // Con teclado: flechas para avanzar o retroceder 5 segundos.
  barra.addEventListener("keydown", (e) => {
    if (!rep.fuente) return;
    if (e.key === "ArrowRight") irA(rep.fuente.posicion() + 5);
    if (e.key === "ArrowLeft") irA(Math.max(0, rep.fuente.posicion() - 5));
  });

  return { el: barra, actualizar: (f) => { if (!arrastrando) dibujar(f); } };
}

// ---------- Mini reproductor ----------
const mini = $("mini");
const lineaMini = h("div", { class: "mini-linea" });

function pintarMini() {
  const c = rep.actual;
  mini.hidden = !c;
  if (!c) return;
  const sonando = rep.fuente.sonando();
  poner(mini, [
    h("button", { class: "mini-info", onclick: abrirGrande, "aria-label": "Abrir reproductor" },
      portada(c, "portada mini-p"),
      h("span", { class: "textos" }, h("span", { class: "t" }, c.titulo), h("span", { class: "a" }, c.artista))),
    h("button", { class: "icon-btn", "aria-label": sonando ? "Pausa" : "Reproducir", onclick: alternar,
      html: sonando ? icono.pausa : icono.play }),
    h("button", { class: "icon-btn", "aria-label": "Siguiente", onclick: () => siguiente(), html: icono.siguiente }),
    h("div", { class: "mini-progreso" }, lineaMini)
  ]);
}

// ---------- Reproductor grande ----------
const grande = $("grande");
let barraGrande = null;
let tiempos = null;

function abrirGrande() {
  grande.hidden = false;
  document.body.classList.add("sin-scroll");
  pintarGrande();
}
function cerrarGrande() {
  grande.hidden = true;
  document.body.classList.remove("sin-scroll");
  colocarVideo();
}

// ---------- Vídeo de YouTube: siempre visible ----------
// Hay un único reproductor (#yt-caja). Nunca se mueve en el DOM (eso reiniciaría
// el vídeo): solo cambiamos su posición con CSS. Con el grande abierto se pone
// encima del hueco ".g-video"; si no, es una ventanita flotante (vídeo de 200x200 px)
// con un asa encima para moverla. La posición se guarda en almacen.js ("posVideo").
const cajaYT = $("yt-caja");
const asa = $("yt-asa");
$("yt-asa-icono").innerHTML = icono.expandir;
const MARGEN = 8;

// Ajusta una posición {x, y} para que la ventanita quede entera dentro de la
// pantalla y por encima de la barra de navegación.
function limitar(p) {
  const ancho = cajaYT.offsetWidth, alto = cajaYT.offsetHeight;
  const suelo = $("tabbar").getBoundingClientRect().top;
  const derecha = document.documentElement.clientWidth - ancho - MARGEN;
  return {
    x: Math.min(Math.max(MARGEN, p.x), derecha),
    y: Math.min(Math.max(MARGEN, p.y), suelo - alto - MARGEN)
  };
}
// Primera vez: esquina derecha, justo encima del mini reproductor.
function posInicial() {
  const tope = (mini.hidden ? $("tabbar") : mini).getBoundingClientRect().top;
  return { x: Infinity, y: tope - cajaYT.offsetHeight - MARGEN };
}
let toque = null; // arrastre en curso del asa (ver más abajo)
function moverVentanita(p) { cajaYT.style.left = p.x + "px"; cajaYT.style.top = p.y + "px"; }

function colocarVideo() {
  const esYT = !!rep.actual && rep.actual.fuente === "youtube";
  cajaYT.hidden = !esYT;
  document.body.classList.toggle("con-video", esYT);
  if (!esYT) return;
  const hueco = !grande.hidden && grande.querySelector(".g-video");
  cajaYT.classList.toggle("flotante", !hueco);
  cajaYT.removeAttribute("style");
  if (!hueco) return moverVentanita(limitar((toque && toque.pos) || leer("posVideo") || posInicial()));
  const r = hueco.getBoundingClientRect();
  Object.assign(cajaYT.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
}
grande.addEventListener("scroll", colocarVideo, { passive: true });
// Al girar el móvil o cambiar el tamaño de la ventana, se vuelve a encajar.
window.addEventListener("resize", colocarVideo);

// Arrastrar el asa (eventos de puntero: ratón y dedo). Si apenas se mueve
// (menos de 6 px), cuenta como un toque y abre el reproductor grande.
asa.addEventListener("pointerdown", (e) => {
  if (!cajaYT.classList.contains("flotante")) return;
  const r = cajaYT.getBoundingClientRect();
  toque = { x0: e.clientX, y0: e.clientY, left: r.left, top: r.top, movido: false, pos: null };
  asa.setPointerCapture(e.pointerId);
});
asa.addEventListener("pointermove", (e) => {
  if (!toque) return;
  const dx = e.clientX - toque.x0, dy = e.clientY - toque.y0;
  if (!toque.movido && Math.hypot(dx, dy) < 6) return;
  toque.movido = true;
  toque.pos = limitar({ x: toque.left + dx, y: toque.top + dy });
  moverVentanita(toque.pos);
});
const soltarAsa = (abrir) => {
  if (!toque) return;
  const t = toque;
  toque = null;
  if (t.movido) guardar("posVideo", t.pos);
  else if (abrir) abrirGrande();
};
asa.addEventListener("pointerup", () => soltarAsa(true));
asa.addEventListener("pointercancel", () => soltarAsa(false));
// Con teclado (Intro o espacio) el clic llega con detail 0: también abre.
asa.addEventListener("click", (e) => { if (e.detail === 0) abrirGrande(); });

function pintarGrande() {
  const c = rep.actual;
  if (grande.hidden || !c) return;
  const sonando = rep.fuente.sonando();
  barraGrande = barraProgreso();
  tiempos = { pos: h("span", {}, "0:00"), dur: h("span", {}, "0:00") };
  const volumen = h("input", { type: "range", min: "0", max: "1", step: "0.01", value: rep.volumen,
    "aria-label": "Volumen", oninput: (e) => ponerVolumen(Number(e.target.value)) });
  const proximas = rep.cola.slice(rep.indice + 1, rep.indice + 21);

  poner(grande, [
    h("div", { class: "g-cabecera" },
      h("button", { class: "icon-btn", "aria-label": "Cerrar reproductor", onclick: cerrarGrande, html: icono.abajo }),
      h("span", {}, "Sonando ahora"),
      h("span", { class: "hueco" })),
    // Canción de YouTube: hueco donde se coloca el vídeo. Si no, la portada.
    c.fuente === "youtube" ? h("div", { class: "g-video" }) : portada(c, "g-portada"),
    h("div", { class: "g-titulos" },
      h("div", { class: "textos" }, h("h2", {}, c.titulo), h("p", {}, c.artista)),
      pantallas.botonCorazon(c),
      h("button", { class: "icon-btn suave", "aria-label": "Añadir a una lista", onclick: () => pantallas.hojaAnadir(c), html: icono.mas }),
      h("button", { class: "icon-btn suave", "aria-label": "Etiquetas", onclick: () => pantallas.hojaEtiquetas(c), html: icono.etiqueta })),
    barraGrande.el,
    h("div", { class: "g-tiempos" }, tiempos.pos, tiempos.dur),
    h("div", { class: "g-controles" },
      h("button", { class: "icon-btn grande-btn", "aria-label": "Anterior", onclick: anterior, html: icono.anterior }),
      h("button", { class: "play-redondo", "aria-label": sonando ? "Pausa" : "Reproducir", onclick: alternar,
        html: sonando ? icono.pausa : icono.play }),
      h("button", { class: "icon-btn grande-btn", "aria-label": "Siguiente", onclick: () => siguiente(), html: icono.siguiente })),
    h("label", { class: "g-volumen" }, h("span", { html: icono.volumen }), volumen),
    h("h3", {}, "A continuación"),
    proximas.length
      ? h("ul", { class: "canciones cola" }, proximas.map((s, i) =>
          h("li", { class: "cancion" }, h("button", { class: "cancion-principal", onclick: () => irAIndice(rep.indice + 1 + i) },
            portada(s, "portada mini-p"),
            h("span", { class: "textos" }, h("span", { class: "t" }, s.titulo), h("span", { class: "a" }, s.artista)),
            marcaFuente(s)))))
      : h("p", { class: "vacio" }, "No hay más canciones en la cola.")
  ]);
  colocarVideo();
  actualizarProgreso();
}

// Cerrar deslizando hacia abajo (eventos táctiles: conviven con el scroll).
let inicioY = null;
grande.addEventListener("touchstart", (e) => {
  inicioY = e.target.closest(".barra, input") || grande.scrollTop > 0 ? null : e.touches[0].clientY;
}, { passive: true });
grande.addEventListener("touchend", (e) => {
  if (inicioY !== null && e.changedTouches[0].clientY - inicioY > 90) cerrarGrande();
  inicioY = null;
});
// Escape cierra primero la hoja de abajo y, si no hay hoja, el reproductor grande.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (hojaAbierta()) cerrarHoja();
  else if (!grande.hidden) cerrarGrande();
});

// Solo se mueven las barras; no se repinta todo en cada segundo.
function actualizarProgreso() {
  if (!rep.fuente) return;
  const pos = rep.fuente.posicion();
  const dur = rep.fuente.duracion() || (rep.actual && rep.actual.duracion) || 0;
  const f = dur ? pos / dur : 0;
  lineaMini.style.width = f * 100 + "%";
  if (!grande.hidden && barraGrande) {
    barraGrande.actualizar(f);
    tiempos.pos.textContent = tiempo(pos);
    tiempos.dur.textContent = tiempo(dur);
  }
}

// ---------- Reaccionar a lo que pasa en el reproductor ----------
alCambiar((tipo) => {
  if (tipo === "progreso") return actualizarProgreso();
  if (tipo === "error") avisar("No se ha podido reproducir esta canción. Prueba con otra.");
  if (tipo === "bloqueo") avisar("Toca el botón de play para empezar a escuchar.");
  pintarMini();
  pintarGrande();
  colocarVideo();
});
