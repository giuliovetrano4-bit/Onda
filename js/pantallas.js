// Las pantallas de la app. Cada una devuelve los nodos que se pintan en <main>.

import { h, poner, icono, portada, tiempo, avisar, marcaFuente, abrirHoja, cerrarHoja, pedirTexto } from "./ui.js";
import {
  leer, guardar, borrarTodo, todasLasListas, obtenerLista, anadirA, quitarDe, esFavorita, alternarFavorita,
  crearLista, renombrarLista, borrarLista, COLORES, obtenerEtiqueta, crearEtiqueta, cambiarEtiqueta,
  borrarEtiqueta, tieneEtiqueta, alternarEtiqueta
} from "./almacen.js";
import { buscarPistas, pistasEnTendencia, GENEROS_AUDIUS } from "./audius.js";
import { buscarVideos } from "./youtube.js";
import { reproducirCola, rep } from "./reproductor.js";

// ---------- Inicio ----------
function saludo() {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 14) return "Buenos días";
  if (hora >= 14 && hora < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function inicio() {
  const historial = leer("historial").slice(0, 15);
  return [
    h("h2", { class: "saludo" }, saludo()),
    h("div", { class: "sorp-caja" }, piezasSorp()),
    h("h3", {}, "Escuchado hace poco"),
    historial.length
      ? h("div", { class: "carrusel" }, historial.map((c, i) =>
          h("button", { class: "tarjeta", onclick: () => reproducirCola(historial, i) },
            portada(c), h("span", { class: "t" }, c.titulo), h("span", { class: "a" }, c.artista))))
      : h("p", { class: "vacio" }, "Aún no has escuchado nada. Ve a Buscar y elige una canción."),
    h("h3", {}, "Tus listas"),
    h("div", { class: "rejilla" },
      todasLasListas().slice(0, 7).map((l) =>
        h("a", { class: "tarjeta-lista", href: "#/lista/" + l.id },
          mosaico(l.canciones), h("span", { class: "t" }, l.nombre), h("span", { class: "a" }, contar(l.canciones.length)))),
      h("button", { class: "lista-nueva", onclick: nuevaLista }, "+ Nueva lista"))
  ];
}

// ---------- Sorpréndeme ----------
// Estado en memoria: si está buscando ahora y si ya se usó (para "Otra tanda").
const sorp = { buscando: false, usado: false };

function piezasSorp() {
  return [
    h("button", { class: "sorprendeme", disabled: sorp.buscando, "aria-busy": String(sorp.buscando), onclick: sorprender },
      h("span", { class: "sorp-onda", html: icono.onda }),
      h("span", {}, h("strong", {}, "Sorpréndeme"),
        h("small", {}, sorp.buscando ? "Buscando música nueva…" : "Unas 10 canciones de artistas que aún no has escuchado"))),
    sorp.usado && !sorp.buscando && h("button", { class: "boton secundario otra-tanda", onclick: sorprender }, "Otra tanda")
  ];
}
// Repinta solo el botón (si Inicio está en pantalla).
function pintarSorp() {
  const caja = document.querySelector(".sorp-caja");
  if (caja) poner(caja, piezasSorp());
}

// Artistas que ya conoces: historial, listas (Favoritas incluida) y etiquetas.
function artistasConocidos() {
  const ids = new Set(), nombres = new Set();
  [leer("historial"), ...todasLasListas().map((l) => l.canciones), ...leer("etiquetas").map((e) => e.canciones)]
    .flat().forEach((c) => {
      if (c.artistaId) ids.add(c.artistaId);
      if (c.artista) nombres.add(c.artista.toLowerCase());
    });
  return { ids, nombres };
}

async function sorprender() {
  if (sorp.buscando) return; // evita dobles toques
  sorp.buscando = true;
  pintarSorp();
  const { ids, nombres } = artistasConocidos();
  const enTanda = new Set(); // artistas ya elegidos en esta tanda
  let tanda = [], fallos = 0;
  // Probamos un género al azar (semana y mes), luego otro género y, al final, sin género.
  const generos = barajar(Object.values(GENEROS_AUDIUS));
  const intentos = [["week", generos[0]], ["month", generos[0]], ["week", generos[1]], ["month", ""]];
  for (const [periodo, genero] of intentos) {
    try {
      for (const c of barajar(await pistasEnTendencia(periodo, genero))) {
        const nombre = c.artista.toLowerCase();
        if (ids.has(c.artistaId) || nombres.has(nombre) || enTanda.has(nombre)) continue;
        enTanda.add(nombre);
        tanda.push(c);
      }
    } catch { fallos++; }
    if (tanda.length >= 10) break;
  }
  sorp.buscando = false;
  tanda = barajar(tanda).slice(0, 10);
  if (tanda.length) {
    sorp.usado = true;
    reproducirCola(tanda, 0); // la primera suena; el resto queda en "A continuación"
  } else if (fallos === intentos.length) {
    avisar("No se pudo conectar con la música libre. Revisa tu conexión e inténtalo otra vez.");
  } else {
    avisar("Ahora mismo no encontramos artistas nuevos para ti. Prueba otra vez en un rato.");
  }
  pintarSorp();
}

// ---------- Piezas comunes de listas ----------
const contar = (n) => (n === 1 ? "1 canción" : `${n} canciones`);

// Portada de una lista: mosaico con las 4 primeras portadas; si hay menos, la primera
// portada; y si está vacía, la portada vacía con la nota.
function mosaico(canciones, clase = "mosaico") {
  if (canciones.length >= 4) return h("div", { class: clase + " cuatro" }, canciones.slice(0, 4).map((c) => portada(c)));
  return portada(canciones[0] || {}, clase + " portada");
}

// Baraja una copia de la lista (algoritmo de Fisher-Yates).
function barajar(lista) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const nuevaLista = () => pedirTexto("Nueva lista", "", "Crear", (nombre) => {
  location.hash = "#/lista/" + crearLista(nombre).id;
});

// Corazón: favorita sí/no. main.js lo mantiene al día con refrescarCorazones().
export function botonCorazon(c, clase = "icon-btn suave") {
  return h("button", { class: clase + " corazon-btn", "data-clave": c.fuente + ":" + c.id,
    "aria-label": "Favorita", "aria-pressed": String(esFavorita(c)), html: icono.corazon,
    onclick: () => avisar(alternarFavorita(c) ? "Guardada en Favoritas" : "Quitada de Favoritas") });
}
export function refrescarCorazones() {
  document.querySelectorAll(".corazon-btn").forEach((b) => {
    const [fuente, ...resto] = b.dataset.clave.split(":");
    b.setAttribute("aria-pressed", String(esFavorita({ fuente, id: resto.join(":") })));
  });
}

// ---------- Hojas desde abajo ----------
// "+": elegir una lista o crear una nueva ahí mismo.
export function hojaAnadir(c) {
  const crear = () => {
    const nombre = campo.value.trim();
    if (!nombre) return campo.focus();
    cerrarHoja();
    anadirA(crearLista(nombre).id, c);
    avisar(`Añadida a «${nombre}»`);
  };
  const campo = h("input", { class: "campo", placeholder: "Nueva lista", maxlength: "40", "aria-label": "Nombre de la nueva lista",
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); crear(); } } });
  abrirHoja("Añadir a una lista",
    h("div", { class: "hoja-opciones" }, todasLasListas().map((l) =>
      h("button", { class: "opcion", onclick: () => {
        cerrarHoja();
        avisar(anadirA(l.id, c) ? `Añadida a «${l.nombre}»` : `Ya estaba en «${l.nombre}»`);
      } }, mosaico(l.canciones, "mosaico mini-p"),
        h("span", { class: "textos" }, h("span", { class: "t" }, l.nombre), h("span", { class: "a" }, contar(l.canciones.length)))))),
    h("div", { class: "fila-campo" }, campo, h("button", { class: "boton", type: "button", onclick: crear }, "Crear")));
}

// Etiquetas de una canción: tocar una píldora la pone o la quita.
export function hojaEtiquetas(c) {
  const crear = () => {
    const nombre = campo.value.trim();
    if (!nombre) return campo.focus();
    alternarEtiqueta(crearEtiqueta(nombre).id, c);
    hojaEtiquetas(c);
  };
  const campo = h("input", { class: "campo", placeholder: "Nueva etiqueta (gym, estudiar…)", maxlength: "24",
    "aria-label": "Nombre de la nueva etiqueta",
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); crear(); } } });
  const todas = leer("etiquetas");
  abrirHoja("Etiquetas",
    todas.length
      ? h("div", { class: "pildoras" }, todas.map((e) => {
          const puesta = tieneEtiqueta(e, c);
          return h("button", { class: "pildora", style: `--color:${e.color}`, "aria-pressed": String(puesta),
            onclick: () => { alternarEtiqueta(e.id, c); hojaEtiquetas(c); } }, (puesta ? "✓ " : "") + e.nombre);
        }))
      : h("p", { class: "vacio" }, "Aún no tienes etiquetas. Crea la primera:"),
    h("div", { class: "fila-campo" }, campo, h("button", { class: "boton", type: "button", onclick: crear }, "Crear")));
}

// Tres puntos de una canción dentro de una lista o etiqueta.
function hojaCancion(c, quitar) {
  abrirHoja(c.titulo, h("div", { class: "hoja-opciones" },
    h("button", { class: "opcion", onclick: () => { cerrarHoja(); quitar.fn(); avisar("Quitada"); } }, quitar.texto),
    h("button", { class: "opcion", onclick: () => hojaAnadir(c) }, "Añadir a otra lista"),
    h("button", { class: "opcion", onclick: () => hojaEtiquetas(c) }, "Etiquetas")));
}

// Fila de colores para elegir; marca el elegido sin repintar la hoja.
function paleta(actual, elegir) {
  const fila = h("div", { class: "paleta" }, COLORES.map((col) =>
    h("button", { class: "color", type: "button", style: `background:${col}`, "aria-label": "Color " + col,
      "aria-pressed": String(col === actual), onclick: (e) => {
        fila.querySelectorAll(".color").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
        elegir(col);
      } })));
  return fila;
}

// Gestionar etiquetas: crear (con color), renombrar, cambiar color y borrar.
function hojaGestionar() {
  let colorNuevo = COLORES[leer("etiquetas").length % COLORES.length];
  const crear = () => {
    const nombre = campoNuevo.value.trim();
    if (!nombre) return campoNuevo.focus();
    crearEtiqueta(nombre, colorNuevo);
    hojaGestionar();
  };
  const campoNuevo = h("input", { class: "campo", placeholder: "Nombre (gym, estudiar…)", maxlength: "24",
    "aria-label": "Nombre de la nueva etiqueta",
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); crear(); } } });

  const filaEtiqueta = (e) => {
    // Renombrar: se guarda al salir del campo o al pulsar Intro.
    const nombre = h("input", { class: "campo", value: e.nombre, maxlength: "24", "aria-label": "Nombre de la etiqueta",
      onkeydown: (ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.target.blur(); } },
      onchange: (ev) => {
        const v = ev.target.value.trim();
        if (v) cambiarEtiqueta(e.id, { nombre: v }); else ev.target.value = e.nombre;
      } });
    return h("div", { class: "gestion" },
      h("div", { class: "fila-campo" }, nombre,
        h("button", { class: "boton peligro", type: "button", onclick: () => {
          if (!confirm(`¿Borrar la etiqueta «${e.nombre}»? Las canciones no se borran.`)) return;
          borrarEtiqueta(e.id);
          hojaGestionar();
        } }, "Borrar")),
      paleta(e.color, (col) => cambiarEtiqueta(e.id, { color: col })));
  };

  abrirHoja("Tus etiquetas",
    leer("etiquetas").map(filaEtiqueta),
    h("div", { class: "gestion" }, h("strong", {}, "Nueva etiqueta"),
      h("div", { class: "fila-campo" }, campoNuevo, h("button", { class: "boton", type: "button", onclick: crear }, "Crear")),
      paleta(colorNuevo, (col) => { colorNuevo = col; })));
}

// Pantalla de lista o etiqueta: cabecera con degradado, aleatorio, reproducir y canciones.
function vistaCanciones({ tipo, nombre, canciones, opciones, quitar, color }) {
  return [
    h("header", { class: "cab-lista" },
      mosaico(canciones),
      h("small", {}, color ? h("span", { class: "punto", style: `background:${color}` }) : null, tipo),
      h("h2", {}, nombre),
      h("p", {}, contar(canciones.length)),
      h("div", { class: "cab-botones" },
        opciones && h("button", { class: "icon-btn", "aria-label": "Opciones", onclick: opciones, html: icono.puntos }),
        h("button", { class: "icon-btn grande-btn", "aria-label": "Reproducir en orden aleatorio", disabled: !canciones.length,
          onclick: () => reproducirCola(barajar(canciones)), html: icono.aleatorio }),
        h("button", { class: "play-redondo", "aria-label": "Reproducir todo", disabled: !canciones.length,
          onclick: () => reproducirCola(canciones), html: icono.play }))),
    canciones.length
      ? h("ul", { class: "canciones" }, canciones.map((c, i) => filaCancion(c, () => reproducirCola(canciones, i), [
          h("button", { class: "icon-btn suave", "aria-label": "Más opciones", html: icono.puntos,
            onclick: () => hojaCancion(c, { texto: quitar.texto, fn: () => quitar.fn(c) }) })])))
      : h("p", { class: "vacio" }, "Aún no hay canciones. Búscalas y toca «+» para añadirlas.")
  ];
}

const noExiste = (texto) => [h("p", { class: "vacio" }, texto), h("a", { class: "enlace", href: "#/biblioteca" }, "Volver a Biblioteca")];

export function lista(id) {
  const l = obtenerLista(id);
  if (!l) return noExiste("Esta lista ya no existe.");
  const propia = l.id !== "favoritas";
  return vistaCanciones({
    tipo: propia ? "Lista" : "Fijada", nombre: l.nombre, canciones: l.canciones,
    quitar: { texto: "Quitar de esta lista", fn: (c) => quitarDe(l.id, c) },
    opciones: propia && (() => abrirHoja(l.nombre, h("div", { class: "hoja-opciones" },
      h("button", { class: "opcion", onclick: () => pedirTexto("Renombrar lista", l.nombre, "Guardar", (n) => renombrarLista(l.id, n)) }, "Renombrar"),
      h("button", { class: "opcion peligro", onclick: () => {
        if (!confirm(`¿Borrar la lista «${l.nombre}»? No se puede deshacer.`)) return;
        cerrarHoja();
        borrarLista(l.id);
        location.hash = "#/biblioteca";
      } }, "Borrar lista"))))
  });
}

export function etiqueta(id) {
  const e = obtenerEtiqueta(id);
  if (!e) return noExiste("Esta etiqueta ya no existe.");
  return vistaCanciones({
    tipo: "Etiqueta", nombre: e.nombre, canciones: e.canciones, color: e.color, opciones: hojaGestionar,
    quitar: { texto: `Quitar la etiqueta «${e.nombre}»`, fn: (c) => alternarEtiqueta(e.id, c) }
  });
}

// ---------- Buscar ----------
const GENEROS = ["Pop", "Reggaetón", "Rap", "Rock", "Electrónica", "Chill", "Jazz", "Lo-fi"];
// La última búsqueda se recuerda al cambiar de pantalla. Cada bloque tiene su estado:
// "cargando", "listo", "error" o (solo YouTube) "sinClave".
const busqueda = {
  texto: "", estado: "inicial", caducada: false,
  libre: { estado: "cargando", lista: [] },
  yt: { estado: "sinClave", lista: [] }
};
let espera;

export function buscar() {
  const zona = h("div", { class: "resultados" });
  const campo = h("input", {
    class: "buscador", type: "search", placeholder: "¿Qué quieres escuchar?",
    value: busqueda.texto, "aria-label": "Buscar canciones",
    oninput: (e) => {
      busqueda.texto = e.target.value;
      clearTimeout(espera); // debounce: esperamos a que deje de escribir
      espera = setTimeout(() => lanzar(zona), 450);
    },
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(espera); lanzar(zona); } }
  });
  // Si cambió la clave de YouTube en Ajustes, repetimos la búsqueda guardada.
  if (busqueda.caducada && busqueda.estado !== "inicial") lanzar(zona);
  else pintarResultados(zona);
  busqueda.caducada = false;
  return [campo, zona];
}

// Lanza las dos búsquedas a la vez; cada bloque se pinta en cuanto llega.
function lanzar(zona) {
  const texto = busqueda.texto.trim();
  if (!texto) { busqueda.estado = "inicial"; return pintarResultados(zona); }
  const clave = leer("claveYoutube");
  busqueda.estado = "buscando";
  busqueda.libre = { estado: "cargando", lista: [] };
  busqueda.yt = { estado: clave ? "cargando" : "sinClave", lista: [] };
  pintarResultados(zona);

  const bloque = async (nombre, buscarFn) => {
    let nuevo;
    try { nuevo = { estado: "listo", lista: await buscarFn() }; }
    catch (e) { nuevo = { estado: "error", lista: [], error: e.message }; }
    if (texto !== busqueda.texto.trim()) return; // llegó tarde: ya buscan otra cosa
    busqueda[nombre] = nuevo;
    pintarResultados(zona);
  };
  bloque("libre", () => buscarPistas(texto));
  if (clave) bloque("yt", () => buscarVideos(texto, clave));
}

// Contenido de un bloque de resultados según su estado.
function contenidoBloque(b, textoError) {
  if (b.estado === "cargando") return h("p", { class: "vacio" }, "Buscando…");
  if (b.estado === "error") return h("p", { class: "vacio" }, textoError || b.error);
  if (!b.lista.length) return h("p", { class: "vacio" }, "No hay resultados. Prueba con otras palabras.");
  return h("ul", { class: "canciones" }, b.lista.map((c, i) => filaCancion(c, () => reproducirCola(b.lista, i))));
}

function pintarResultados(zona) {
  const { estado, libre, yt } = busqueda;
  let contenido;
  if (estado === "inicial") {
    contenido = [h("h3", {}, "Explora por géneros"), h("div", { class: "generos" }, GENEROS.map((g, i) =>
      h("button", { class: `genero g${i % 4}`, onclick: () => {
        busqueda.texto = g;
        const input = document.querySelector(".buscador");
        if (input) input.value = g;
        lanzar(zona);
      } }, g)))];
  } else {
    // Sin clave de YouTube: solo el bloque de música libre, con un aviso amable arriba.
    contenido = [
      yt.estado === "sinClave"
        ? h("div", { class: "nota-yt" },
            h("p", {}, "Para buscar en YouTube, añade tu clave en Ajustes."),
            h("a", { class: "boton", href: "#/ajustes" }, "Ir a Ajustes"))
        : h("section", { class: "bloque" }, h("h3", {}, "YouTube"), contenidoBloque(yt)),
      h("section", { class: "bloque" },
        h("h3", {}, "Música libre"),
        contenidoBloque(libre, "Vaya, no hemos podido conectar con la música libre. Revisa tu conexión y vuelve a probar."))
    ];
  }
  poner(zona, contenido);
}

// Fila de una canción: portada, título, artista, duración y botones (por defecto corazón y "+").
export function filaCancion(c, alTocar, botones) {
  const sonando = rep.actual && rep.actual.id === c.id && rep.actual.fuente === c.fuente;
  return h("li", { class: "cancion" + (sonando ? " activa" : "") },
    h("button", { class: "cancion-principal", onclick: alTocar },
      portada(c, "portada mini-p"),
      h("span", { class: "textos" }, h("span", { class: "t" }, c.titulo), h("span", { class: "a" }, c.artista)),
      marcaFuente(c),
      h("span", { class: "dur" }, c.duracion ? tiempo(c.duracion) : "")),
    botones || [botonCorazon(c),
      h("button", { class: "icon-btn suave", "aria-label": "Añadir a una lista", onclick: () => hojaAnadir(c), html: icono.mas })]);
}

// ---------- Biblioteca ----------
export function biblioteca() {
  const etiquetas = leer("etiquetas");
  return [
    h("button", { class: "boton crear", onclick: nuevaLista }, "+ Crear lista"),
    h("h3", {}, "Etiquetas"),
    h("div", { class: "pildoras fila" },
      etiquetas.map((e) => h("a", { class: "pildora", href: "#/etiqueta/" + e.id, style: `--color:${e.color}` }, e.nombre)),
      h("button", { class: "pildora gestionar", onclick: hojaGestionar }, etiquetas.length ? "Gestionar" : "+ Crear etiqueta")),
    h("h3", {}, "Tus listas"),
    h("ul", { class: "listas" }, todasLasListas().map((l) => h("li", {},
      h("a", { class: "fila-lista", href: "#/lista/" + l.id },
        mosaico(l.canciones),
        h("span", { class: "textos" },
          h("span", { class: "t" }, l.nombre),
          h("span", { class: "a" }, (l.id === "favoritas" ? "Fijada · " : "") + contar(l.canciones.length)))))))
  ];
}

// ---------- Ajustes ----------
const GUIA_CLAVE = "https://developers.google.com/youtube/v3/getting-started";

export function ajustes() {
  const tieneClave = () => !!leer("claveYoutube");
  const estado = h("p", { class: "nota" });
  const pintarEstado = () => {
    estado.textContent = tieneClave() ? "✓ Tienes una clave guardada." : "Aún no has guardado ninguna clave.";
  };
  pintarEstado();

  // Campo tipo contraseña: la clave no se ve salvo que se pulse "Mostrar".
  const campo = h("input", {
    id: "clave-yt", class: "campo", type: "password", value: leer("claveYoutube"),
    placeholder: "Pega aquí tu clave", autocomplete: "off", spellcheck: "false",
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); guardarClave(); } }
  });
  const ver = h("button", { class: "boton secundario", type: "button", "aria-pressed": "false",
    onclick: () => {
      const mostrar = campo.type === "password";
      campo.type = mostrar ? "text" : "password";
      ver.textContent = mostrar ? "Ocultar" : "Mostrar";
      ver.setAttribute("aria-pressed", String(mostrar));
    } }, "Mostrar");

  function guardarClave() {
    const valor = campo.value.trim();
    if (!valor) return avisar("Pega primero tu clave");
    guardar("claveYoutube", valor);
    busqueda.caducada = true; // al volver a Buscar se repite la búsqueda
    pintarEstado();
    avisar("Clave guardada");
  }
  function borrarClave() {
    if (!tieneClave() || !confirm("¿Borrar tu clave de YouTube de este navegador?")) return;
    guardar("claveYoutube", "");
    campo.value = "";
    busqueda.caducada = true;
    pintarEstado();
    avisar("Clave borrada");
  }
  function borrarHistorial() {
    if (!confirm("¿Borrar el historial de lo que has escuchado?")) return;
    guardar("historial", []);
    avisar("Historial borrado");
  }
  function borrarDatos() {
    if (!confirm("¿Borrar todos los datos de Onda en este navegador (listas, favoritas, etiquetas, clave, historial, volumen…)? No se puede deshacer.")) return;
    borrarTodo();
    busqueda.caducada = true;
    poner(document.getElementById("app"), ajustes()); // repintamos la pantalla vacía
    avisar("Datos borrados");
  }

  return [
    h("section", { class: "ajuste" },
      h("h2", {}, "Clave de YouTube"),
      h("p", {}, "Para buscar en YouTube, Onda usa una clave gratuita tuya (de Google Cloud, con «YouTube Data API v3» activada). Se guarda solo en este navegador."),
      h("a", { class: "enlace", href: GUIA_CLAVE, target: "_blank", rel: "noopener" }, "Cómo crear tu clave gratis (guía de Google)"),
      h("label", { class: "etiqueta", for: "clave-yt" }, "Tu clave"),
      h("div", { class: "fila-campo" }, campo, ver),
      h("div", { class: "botones" },
        h("button", { class: "boton", type: "button", onclick: guardarClave }, "Guardar"),
        h("button", { class: "boton secundario", type: "button", onclick: borrarClave }, "Borrar clave")),
      estado),
    h("section", { class: "ajuste" },
      h("h2", {}, "Tus datos"),
      h("p", {}, "Todo se guarda solo en este navegador. Si lo borras, no se puede recuperar."),
      h("div", { class: "botones" },
        h("button", { class: "boton secundario", type: "button", onclick: borrarHistorial }, "Borrar historial"),
        h("button", { class: "boton peligro", type: "button", onclick: borrarDatos }, "Borrar todos los datos")))
  ];
}
