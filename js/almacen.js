// Almacén central: todo lo que se guarda en el navegador pasa por aquí.
// Así, si mañana cambia la forma de guardar, solo se toca este archivo.

const PREFIJO = "onda:";

// Valores iniciales de cada dato guardado.
const INICIALES = {
  historial: [],   // últimas canciones escuchadas (la más reciente primero)
  volumen: 0.8,    // de 0 a 1
  favoritas: [],   // canciones favoritas
  listas: [],      // listas propias: { id, nombre, canciones }
  etiquetas: [],   // etiquetas propias: { id, nombre, color, canciones }
  posVideo: null,  // dónde dejó la persona la ventanita del vídeo: { x, y }
  claveYoutube: "" // clave de YouTube que la persona pega en Ajustes
};

// Borra todo lo que Onda ha guardado en este navegador (solo las claves "onda:").
export function borrarTodo() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Sin acceso al almacenamiento: no hay nada que borrar.
  }
  avisarCambio();
}

// Lee un dato. Si no existe o está roto, devuelve el valor inicial.
export function leer(nombre) {
  try {
    const texto = localStorage.getItem(PREFIJO + nombre);
    return texto === null ? structuredClone(INICIALES[nombre]) : JSON.parse(texto);
  } catch {
    return structuredClone(INICIALES[nombre]);
  }
}

// Guarda un dato (convertido a texto JSON).
export function guardar(nombre, valor) {
  try {
    localStorage.setItem(PREFIJO + nombre, JSON.stringify(valor));
  } catch {
    // Modo privado o sin espacio: la app sigue funcionando sin guardar.
  }
}

// Solo guardamos la información de la canción, nunca el audio.
export function resumirCancion(c) {
  return { fuente: c.fuente, id: c.id, titulo: c.titulo, artista: c.artista, artistaId: c.artistaId, portada: c.portada, duracion: c.duracion };
}

// Añade una canción al historial (sin repetir y como máximo 50).
export function apuntarEnHistorial(cancion) {
  const lista = leer("historial").filter((c) => !(c.id === cancion.id && c.fuente === cancion.fuente));
  lista.unshift(resumirCancion(cancion));
  guardar("historial", lista.slice(0, 50));
}

// ---------- Avisar a las pantallas cuando cambian listas, favoritas o etiquetas ----------
const oyentesDatos = new Set();
export function alCambiarDatos(fn) { oyentesDatos.add(fn); }
function avisarCambio() { oyentesDatos.forEach((fn) => fn()); }

// Dos canciones son la misma si coinciden fuente e identificador.
const misma = (a, b) => a.fuente === b.fuente && a.id === b.id;
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- Listas (Favoritas se trata como una lista más, con id "favoritas") ----------
export function todasLasListas() {
  return [{ id: "favoritas", nombre: "Favoritas", canciones: leer("favoritas") }, ...leer("listas")];
}
export function obtenerLista(id) { return todasLasListas().find((l) => l.id === id) || null; }

function guardarCanciones(id, canciones) {
  if (id === "favoritas") guardar("favoritas", canciones);
  else guardar("listas", leer("listas").map((l) => (l.id === id ? { ...l, canciones } : l)));
  avisarCambio();
}
export const estaEn = (id, c) => !!obtenerLista(id)?.canciones.some((x) => misma(x, c));

// Devuelve false si la canción ya estaba en la lista.
export function anadirA(id, c) {
  const l = obtenerLista(id);
  if (!l || estaEn(id, c)) return false;
  guardarCanciones(id, [...l.canciones, resumirCancion(c)]);
  return true;
}
export function quitarDe(id, c) {
  const l = obtenerLista(id);
  if (l) guardarCanciones(id, l.canciones.filter((x) => !misma(x, c)));
}

export const esFavorita = (c) => estaEn("favoritas", c);
// Devuelve true si ha quedado como favorita.
export function alternarFavorita(c) {
  if (esFavorita(c)) { quitarDe("favoritas", c); return false; }
  return anadirA("favoritas", c);
}

export function crearLista(nombre) {
  const l = { id: nuevoId(), nombre, canciones: [] };
  guardar("listas", [...leer("listas"), l]);
  avisarCambio();
  return l;
}
export function renombrarLista(id, nombre) {
  guardar("listas", leer("listas").map((l) => (l.id === id ? { ...l, nombre } : l)));
  avisarCambio();
}
export function borrarLista(id) {
  guardar("listas", leer("listas").filter((l) => l.id !== id));
  avisarCambio();
}

// ---------- Etiquetas propias ----------
// Paleta de colores suaves (sin verde, como pide la identidad de Onda).
export const COLORES = ["#ffd9e2", "#ffe2c6", "#fff1b3", "#e5dcff", "#d3ecff", "#cdf1f0", "#f3d9f5", "#e3e9f2"];

export function obtenerEtiqueta(id) { return leer("etiquetas").find((e) => e.id === id) || null; }

export function crearEtiqueta(nombre, color) {
  const todas = leer("etiquetas");
  const e = { id: nuevoId(), nombre, color: color || COLORES[todas.length % COLORES.length], canciones: [] };
  guardar("etiquetas", [...todas, e]);
  avisarCambio();
  return e;
}
// cambios: { nombre }, { color } o { canciones }
export function cambiarEtiqueta(id, cambios) {
  guardar("etiquetas", leer("etiquetas").map((e) => (e.id === id ? { ...e, ...cambios } : e)));
  avisarCambio();
}
export function borrarEtiqueta(id) {
  guardar("etiquetas", leer("etiquetas").filter((e) => e.id !== id));
  avisarCambio();
}
export const tieneEtiqueta = (e, c) => e.canciones.some((x) => misma(x, c));
// Pone la etiqueta si no la tiene y la quita si la tiene.
export function alternarEtiqueta(id, c) {
  const e = obtenerEtiqueta(id);
  if (!e) return;
  cambiarEtiqueta(id, { canciones: tieneEtiqueta(e, c)
    ? e.canciones.filter((x) => !misma(x, c))
    : [...e.canciones, resumirCancion(c)] });
}
