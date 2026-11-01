// Conexión con la API pública de Audius (música libre).
// La documentación pide identificar la app con "app_name" en cada petición.

const APP = "Onda";
let base = "https://api.audius.co/v1"; // puerta de entrada general de Audius

// Si la puerta general falla, Audius ofrece una lista de servidores
// ("discovery nodes") en https://api.audius.co. Elegimos uno al azar.
async function cambiarServidor() {
  const resp = await fetch("https://api.audius.co");
  const { data } = await resp.json();
  if (!data || !data.length) throw new Error("Sin servidores");
  base = data[Math.floor(Math.random() * data.length)] + "/v1";
}

// Hace una petición GET y devuelve el campo "data" de la respuesta.
async function pedir(ruta, params = {}) {
  const qs = new URLSearchParams({ ...params, app_name: APP });
  const intentar = async () => {
    const resp = await fetch(`${base}${ruta}?${qs}`);
    if (!resp.ok) throw new Error("Error " + resp.status);
    return (await resp.json()).data || [];
  };
  try {
    return await intentar();
  } catch {
    await cambiarServidor(); // segundo intento con otro servidor
    return await intentar();
  }
}

// Convierte una pista de Audius al formato común de Onda.
function aCancion(p) {
  const art = p.artwork || {};
  return {
    fuente: "audius",
    id: p.id,
    titulo: p.title,
    artista: p.user ? p.user.name : "Artista desconocido",
    artistaId: p.user ? p.user.id : "", // para que Sorpréndeme reconozca al artista
    portada: art["480x480"] || art["150x150"] || "",
    duracion: p.duration || 0
  };
}

// Busca pistas por texto.
export async function buscarPistas(texto) {
  const datos = await pedir("/tracks/search", { query: texto, limit: 20 });
  return datos.filter((p) => p.is_streamable !== false).map(aCancion);
}

// Nombre de género que entiende Audius para cada tarjeta de Buscar.
export const GENEROS_AUDIUS = {
  "Pop": "Pop", "Reggaetón": "Latin", "Rap": "Hip-Hop/Rap", "Rock": "Rock",
  "Electrónica": "Electronic", "Chill": "Downtempo", "Jazz": "Jazz", "Lo-fi": "Lo-Fi"
};

// Pistas en tendencia del periodo ("week" o "month"), de un género si se indica.
export async function pistasEnTendencia(periodo, genero) {
  const params = { time: periodo, limit: 100 };
  if (genero) params.genre = genero;
  const datos = await pedir("/tracks/trending", params);
  return datos.filter((p) => p.is_streamable !== false && p.user).map(aCancion);
}

// Direcciones posibles del audio de una pista, de mejor a peor.
// Audius da un enlace directo y varios servidores de reserva ("mirrors")
// con la misma ruta: si uno está caído, el reproductor prueba el siguiente.
export async function urlsAudio(id) {
  const general = `${base}/tracks/${encodeURIComponent(id)}/stream?app_name=${APP}`;
  try {
    const resp = await fetch(`${base}/tracks/${encodeURIComponent(id)}?app_name=${APP}`);
    const stream = (await resp.json()).data?.stream;
    if (!stream?.url) return [general];
    const ruta = new URL(stream.url);
    const reservas = (stream.mirrors || []).map((m) => m + ruta.pathname + ruta.search);
    return [stream.url, ...reservas, general];
  } catch {
    return [general];
  }
}
