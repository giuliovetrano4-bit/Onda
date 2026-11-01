# Onda

App web de música pensada para el móvil, clara y sin anuncios propios. Buscas casi cualquier canción, la escuchas, la guardas en tus listas con tus propias etiquetas y descubres artistas nuevos con un solo botón.

**Inspirada en Spotify** (solo como referencia de funciones). No es una app oficial ni contiene nada del original: mira [LEGAL.md](LEGAL.md).

## Qué hace

- **Reproductor**: mini reproductor fijo abajo que sigue sonando al cambiar de pantalla y reproductor grande (portada o vídeo, barra de progreso arrastrable, anterior, play/pausa, siguiente, volumen y cola "A continuación"). Se cierra con la flecha o deslizando hacia abajo.
- **Búsqueda en dos fuentes**: YouTube y Música libre (Audius), con tarjetas de géneros. Corazón para Favoritas y "+" para añadir a una lista.
- **Biblioteca**: Favoritas fijada arriba y tus listas (crear, renombrar, borrar, añadir y quitar canciones), con portada en mosaico, botón de reproducir y de aleatorio.
- **Sorpréndeme**: unas 10 canciones de artistas que nunca has escuchado en Onda. Puedes pedir otra tanda.
- **Etiquetas propias** (gym, estudiar, fiesta…) con su color. Tocando una píldora en Biblioteca ves y reproduces todas sus canciones.
- **Vídeo de YouTube siempre visible**: en el reproductor grande o en una ventanita de 200×200 px que puedes mover con su asa (Onda recuerda dónde la dejaste).
- Se puede **añadir a la pantalla de inicio** del móvil, con nombre e icono propios.

Todo se guarda en tu navegador (`localStorage`): listas, favoritas, etiquetas, historial, volumen y tu clave de YouTube. No hay servidor ni cuentas; si borras los datos del navegador o cambias de móvil, se pierden.

## Probarla en tu ordenador

Desde la carpeta raíz de ClonaKit:

```bash
npm run probar -- onda
```

Se abrirá en http://localhost:3000. No hace falta instalar nada más: es HTML, CSS y JavaScript sin build.

## La clave de YouTube

La música libre funciona sin configurar nada. Para buscar también en YouTube, **cada persona pega su propia clave** en Ajustes (el engranaje de arriba). La clave se queda solo en su navegador y nunca va dentro del código de la app.

Cómo conseguirla (gratis):

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto.
2. En "APIs y servicios" > "Biblioteca", activa **YouTube Data API v3**.
3. En "APIs y servicios" > "Credenciales", crea una **clave de API** y cópiala en Ajustes de Onda.

**Restríngela** (recomendado): como la app funciona en el navegador, cualquiera podría ver la clave en las peticiones. En la página de la clave, en Credenciales:

- **Restricciones de aplicación** > **Sitios web**: añade las direcciones desde donde usas Onda, por ejemplo `https://tu-onda.vercel.app/*` y, para probar, `http://localhost:3000/*`.
- **Restricciones de API** > **Restringir clave**: marca solo **YouTube Data API v3**.

Así, aunque alguien la copie, no podrá usarla desde otra web ni para otros servicios. La clave tiene una cuota diaria gratuita; si se agota, Onda lo avisa y al día siguiente vuelve a funcionar.

## Publicarla

Es una web estática (no hay build):

1. Sube el proyecto a GitHub.
2. En [Vercel](https://vercel.com), importa el repositorio, elige como carpeta raíz (**Root Directory**) `clones/onda/app`, el preset **Other** y deja vacío el comando de build.
3. Cuando tengas la dirección (`https://….vercel.app`), añádela a las restricciones de tu clave de YouTube.

También vale cualquier hosting de archivos estáticos (Netlify, GitHub Pages…): basta con publicar el contenido de esta carpeta. Para "añadir a la pantalla de inicio" la web tiene que estar en `https`.

## Archivos

- `index.html`, `style.css` y `js/`: la app (detalles en `../CONSTRUCCION.md`).
- `manifest.webmanifest`, `icono.svg`, `icono-192.png`, `icono-512.png`: nombre, colores e icono para instalarla en el móvil.

## Fuentes de música

- **Música libre**: API pública de [Audius](https://audius.co). Onda se identifica como "Onda" en cada petición y muestra el artista de cada canción.
- **YouTube**: búsqueda con YouTube Data API v3 y reproducción con el reproductor oficial incrustado, siempre visible y sin tapar sus anuncios ni controles.
