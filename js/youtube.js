// Búsqueda en YouTube (YouTube Data API v3) con la clave que la persona pega en Ajustes.
// La clave nunca va escrita aquí: llega como parámetro desde almacen.js.

const API = "https://www.googleapis.com/youtube/v3";

// Los títulos llegan con entidades HTML ("&amp;", "&#39;"...): las convertimos en texto normal.
function decodificar(texto) {
  return new DOMParser().parseFromString(texto || "", "text/html").documentElement.textContent;
}

// Duración en formato ISO 8601 ("PT3M25S") -> segundos (205).
function segundos(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  return m ? (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0) : 0;
}

// Traduce los errores de YouTube a mensajes claros en español.
function mensajeError(estado, datos) {
  const err = (datos && datos.error) || {};
  const razon = [err.errors?.[0]?.reason, err.details?.[0]?.reason, err.status].join(" ");
  if (/quota|dailyLimit|rateLimit/i.test(razon)) return "Se ha agotado la cuota diaria de tu clave de YouTube. Vuelve a probar mañana.";
  if (/accessNotConfigured|SERVICE_DISABLED/i.test(razon)) return "Tu clave aún no tiene activada «YouTube Data API v3». Actívala en Google Cloud y vuelve a probar.";
  if (/keyInvalid|API_KEY_INVALID/i.test(razon) || estado === 400) return "Tu clave de YouTube no es válida. Revísala en Ajustes.";
  if (estado === 403) return "YouTube ha rechazado tu clave. Revisa sus restricciones en Google Cloud.";
  return "No hemos podido conectar con YouTube. Revisa tu conexión y vuelve a probar.";
}

// Petición GET a la API; si algo falla, lanza un error con el mensaje en español.
async function pedir(ruta, params, clave) {
  let resp;
  try {
    resp = await fetch(`${API}/${ruta}?${new URLSearchParams({ ...params, key: clave })}`);
  } catch {
    throw new Error(mensajeError(0, null));
  }
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(mensajeError(resp.status, datos));
  return datos;
}

// Busca vídeos musicales que se puedan incrustar y los pasa al formato común de Onda.
export async function buscarVideos(texto, clave) {
  const busq = await pedir("search", {
    part: "snippet", type: "video", videoCategoryId: "10",
    videoEmbeddable: "true", maxResults: "10", q: texto
  }, clave);
  const items = (busq.items || []).filter((i) => i.id && i.id.videoId);

  // Segunda llamada (opcional) para saber cuánto dura cada vídeo.
  const duraciones = {};
  if (items.length) {
    try {
      const det = await pedir("videos", { part: "contentDetails", id: items.map((i) => i.id.videoId).join(",") }, clave);
      for (const v of det.items || []) duraciones[v.id] = segundos(v.contentDetails.duration);
    } catch {
      // Sin duraciones también se puede escuchar.
    }
  }

  return items.map((i) => {
    const s = i.snippet || {};
    const mini = s.thumbnails || {};
    return {
      fuente: "youtube",
      id: i.id.videoId,
      titulo: decodificar(s.title),
      artista: decodificar(s.channelTitle).replace(/ - Topic$/, "") || "Canal desconocido",
      portada: (mini.high || mini.medium || mini.default || {}).url || "",
      duracion: duraciones[i.id.videoId] || 0
    };
  });
}
