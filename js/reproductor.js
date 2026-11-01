// Reproductor con cola. Cada "fuente" (Audius y YouTube) cumple la misma
// interfaz: cargar, reproducir, pausar, irA, volumen, posicion, duracion,
// sonando, detener, y avisa con onProgreso / onFin / onEstado / onError.

import { urlsAudio } from "./audius.js";
import { leer, guardar, apuntarEnHistorial } from "./almacen.js";

// --- Fuente "audius": usa un elemento <audio> de HTML ---
function crearFuenteAudio() {
  const audio = new Audio();
  audio.preload = "auto";
  let pendientes = []; // direcciones que quedan por probar si la actual falla
  let espera = null;   // temporizador: si un servidor no responde, pasamos al siguiente

  // Prueba la siguiente dirección de la lista; si no quedan, avisa del error.
  function probarSiguiente() {
    clearTimeout(espera);
    const url = pendientes.shift();
    if (!url) return fuente.onError();
    audio.src = url;
    espera = setTimeout(probarSiguiente, 8000);
    // Si el navegador no deja empezar solo (pasa en algunos móviles), no es un fallo
    // del servidor: dejamos de probar otros y pedimos a la persona que toque play.
    audio.play().catch((e) => {
      if (e.name !== "NotAllowedError") return;
      clearTimeout(espera);
      fuente.onError("bloqueo");
    });
  }

  const fuente = {
    onProgreso: () => {}, onFin: () => {}, onEstado: () => {}, onError: () => {},
    async cargar(cancion) {
      audio.pause();
      pendientes = await urlsAudio(cancion.id);
      probarSiguiente();
    },
    reproducir() { return audio.play(); },
    pausar() { audio.pause(); },
    irA(segundos) { audio.currentTime = segundos; },
    volumen(v) { audio.volume = v; },
    posicion: () => audio.currentTime || 0,
    duracion: () => (isFinite(audio.duration) ? audio.duration : 0),
    sonando: () => !audio.paused,
    detener() { clearTimeout(espera); pendientes = []; audio.pause(); audio.removeAttribute("src"); }
  };
  // En cuanto el audio puede sonar, ya no hace falta cambiar de servidor.
  audio.addEventListener("canplay", () => clearTimeout(espera));
  audio.addEventListener("timeupdate", () => fuente.onProgreso());
  audio.addEventListener("ended", () => fuente.onFin());
  audio.addEventListener("play", () => fuente.onEstado());
  audio.addEventListener("pause", () => fuente.onEstado());
  // Si falla una dirección (y no es porque la hayamos quitado), probamos otra.
  audio.addEventListener("error", () => { if (audio.getAttribute("src")) probarSiguiente(); });
  return fuente;
}

// --- Fuente "youtube": reproductor oficial incrustado (IFrame Player API) ---
// El vídeo se pinta en #yt-player (index.html), que main.js mantiene siempre visible.
function crearFuenteYoutube() {
  let player = null;  // existe cuando YouTube dice que está listo
  let listo = null;   // promesa: el script se carga solo la primera vez
  let reloj = null;   // YouTube no avisa del progreso: lo preguntamos cada medio segundo
  let vol = 1;

  function prepararAPI() {
    if (!listo) listo = new Promise((ok, mal) => {
      window.onYouTubeIframeAPIReady = () => {
        new YT.Player("yt-player", {
          width: "100%", height: "100%",
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => { player = e.target; ok(); },
            onStateChange: cambio,
            onError: () => fuente.onError() // vídeo borrado, privado o no incrustable
          }
        });
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => { listo = null; mal(new Error("No se pudo cargar YouTube")); };
      document.head.append(s);
    });
    return listo;
  }

  function cambio(e) {
    clearInterval(reloj);
    if (e.data === YT.PlayerState.PLAYING) reloj = setInterval(() => fuente.onProgreso(), 500);
    if (e.data === YT.PlayerState.ENDED) fuente.onFin();
    fuente.onEstado();
  }

  const fuente = {
    onProgreso: () => {}, onFin: () => {}, onEstado: () => {}, onError: () => {},
    async cargar(cancion) {
      await prepararAPI();
      if (rep.actual !== cancion) return; // mientras cargaba, eligieron otra canción
      player.setVolume(Math.round(vol * 100));
      player.loadVideoById(cancion.id);
    },
    reproducir() { if (player) player.playVideo(); return Promise.resolve(); },
    pausar() { if (player) player.pauseVideo(); },
    irA(segundos) { if (player) player.seekTo(segundos, true); },
    volumen(v) { vol = v; if (player) player.setVolume(Math.round(v * 100)); },
    posicion: () => (player ? player.getCurrentTime() || 0 : 0),
    duracion: () => (player ? player.getDuration() || 0 : 0),
    // "Cargando" (3) cuenta como sonando para que el botón muestre pausa.
    sonando: () => !!player && [1, 3].includes(player.getPlayerState()),
    detener() { clearInterval(reloj); if (player) player.stopVideo(); }
  };
  return fuente;
}

// Registro de fuentes: todas cumplen la misma interfaz.
const fuentes = { audius: crearFuenteAudio(), youtube: crearFuenteYoutube() };

// Estado del reproductor.
export const rep = {
  cola: [],
  indice: -1,
  volumen: leer("volumen"),
  get actual() { return this.cola[this.indice] || null; },
  get fuente() { return this.actual ? fuentes[this.actual.fuente] : null; }
};

// Quien quiera enterarse de cambios (mini, grande...) se apunta aquí.
const oyentes = new Set();
export function alCambiar(fn) { oyentes.add(fn); }
function avisar(tipo) { oyentes.forEach((fn) => fn(tipo)); }

// Conectamos los eventos de cada fuente con el reproductor.
for (const f of Object.values(fuentes)) {
  f.volumen(rep.volumen);
  f.onProgreso = () => avisar("progreso");
  f.onEstado = () => avisar("estado");
  f.onFin = () => siguiente(true);
  // motivo "bloqueo": el navegador no deja sonar sin un toque (no es un error de la canción).
  f.onError = (motivo) => avisar(motivo === "bloqueo" ? "bloqueo" : "error");
}

// Pone una lista de canciones como cola y empieza por la elegida.
export function reproducirCola(canciones, desde = 0) {
  rep.cola = canciones.slice();
  tocar(desde);
}

function tocar(i) {
  if (i < 0 || i >= rep.cola.length) return;
  const antes = rep.fuente;
  rep.indice = i;
  // Si cambia de fuente (audio <-> YouTube), paramos del todo la anterior.
  if (antes && antes !== rep.fuente) antes.detener();
  else if (antes) antes.pausar();
  apuntarEnHistorial(rep.actual);
  // play() devuelve una promesa; si el navegador la rechaza, avisamos.
  rep.fuente.cargar(rep.actual).catch((e) => { if (e.name !== "AbortError") avisar("error"); });
  avisar("cancion");
}

export function alternar() {
  if (!rep.fuente) return;
  if (rep.fuente.sonando()) rep.fuente.pausar();
  else rep.fuente.reproducir().catch((e) => { if (e.name !== "AbortError") avisar("error"); });
}

// alTerminar = true cuando la canción acabó sola: en la última, se para.
export function siguiente(alTerminar = false) {
  if (rep.indice < rep.cola.length - 1) tocar(rep.indice + 1);
  else if (alTerminar) avisar("estado");
}

// Si ya han pasado 3 segundos, "anterior" vuelve al principio de la canción.
export function anterior() {
  if (!rep.fuente) return;
  if (rep.fuente.posicion() > 3 || rep.indice === 0) rep.fuente.irA(0);
  else tocar(rep.indice - 1);
}

export function irA(segundos) { if (rep.fuente) rep.fuente.irA(segundos); }

export function ponerVolumen(v) {
  rep.volumen = v;
  Object.values(fuentes).forEach((f) => f.volumen(v));
  guardar("volumen", v);
}

export function irAIndice(i) { tocar(i); }
