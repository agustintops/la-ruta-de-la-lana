# La ruta de la lana: sitio para Netlify

Juego de Tops Fray Marcos S.A. con registro de uso en Neon.

## Qué hay en esta carpeta

- `public/index.html`: el juego completo, en un solo archivo.
- `netlify/functions/evento.mjs`: la función que recibe los registros de uso y los guarda en Neon. Queda disponible en `/api/evento`.
- `netlify/functions/contenido.mjs`: la función que lee el contenido de la planilla de Google. Queda disponible en `/api/contenido`.
- `netlify.toml` y `package.json`: configuración del sitio.

## Cómo publicarlo

Arrastrar la carpeta al panel de Netlify publica el juego, pero **no** la función. Para que el registro de uso funcione hay que publicar con una de estas dos vías:

1. **Desde un repositorio de Git** (recomendado): subir esta carpeta a un repositorio y, en Netlify, elegir "Add new site" y luego "Import an existing project".
2. **Con la herramienta de línea de comandos de Netlify**: dentro de la carpeta, `npm install`, y después `npx netlify deploy --prod`.

## Variable de entorno

En Netlify, en la configuración del sitio, sección de variables de entorno, crear:

- `DATABASE_URL`: la cadena de conexión del proyecto `ruta-de-la-lana` de Neon. Se copia desde el panel de Neon, botón "Connect". Es una clave: no compartirla ni subirla al repositorio.

Después de crearla hay que volver a publicar el sitio.

- `SHEET_ID`: el identificador de la planilla de contenido. Es el tramo largo de su dirección, entre `/d/` y `/edit`. Para la planilla actual: `13hD8fLuLmwUvjUnVDkPPO8oggVcXP5Q0jxQslFP_gpU`.

## Contenido editable (planilla de Google)

El juego pide su contenido a `/api/contenido`, que lo lee de la planilla "La ruta de la lana: contenido del juego". Para que funcione, la planilla tiene que estar compartida como "Cualquier persona con el enlace: lector". Eso deja el contenido del juego legible para quien tenga el enlace; no da permiso para editar.

- Un cambio en la planilla tarda hasta unos cinco minutos en verse en el juego.
- Si la planilla no se puede leer, el juego usa el contenido que trae adentro y sigue funcionando.
- Las filas incompletas (sin pregunta, sin respuesta correcta, con menos de dos opciones) se descartan.
- La planilla vive en la cuenta supervisorestops@gmail.com y ya trae la categoría `Hilado y tejido`.

## Base de datos (proyecto Neon `ruta-de-la-lana`)

- `participantes`: una fila por persona o grupo que empieza a jugar.
- `eventos`: respuestas, trivias terminadas, sellos, juegos completados y diplomas.
- `invitaciones`: códigos de los enlaces personales.
- Vistas `resumen_participantes` y `preguntas_falladas`: para consultar el impacto.

## Enlaces personales

Para que el avance de alguien quede a su nombre sin que escriba nada:

1. Agregar una fila en `invitaciones` con un código único en `token`, y su nombre y correo.
2. Enviarle la dirección del sitio con `?t=` y el código al final. Ejemplo: `https://el-sitio.netlify.app/?t=abc123`.

## Qué se guarda

- En modo individual: el perfil elegido y el avance. Nombre y correo solo si la persona los escribe y marca la casilla de aceptación.
- En modo grupo: el nombre del grupo y la cantidad de personas.
- Nunca se guardan datos personales de niños.

## Tablero de impacto

Está en `/tablero` (por ejemplo `https://ruta-de-la-lana.netlify.app/tablero`). Muestra personas alcanzadas, partidas, diplomas, perfiles, sellos por estación, juegos, las preguntas que más cuestan y las personas registradas.

Pide una clave. Se define en Netlify, en "Keys and secrets", con una variable nueva:

- Nombre: `TABLERO_CLAVE`
- Valor: la clave que elijan (marcar "Contains secret values")

Después de guardarla hay que volver a publicar. Para cambiar la clave se edita esa variable y se publica de nuevo.

## Enlaces para un público o un envío

Al enlace del juego se le pueden agregar estos datos (en el tablero hay un armador que lo hace solo):

- `?perfil=` fija el público y saltea la elección: `chico`, `grande`, `productor`, `trabajador`, `esquilador`, `consignatario`, `industria`, `tecnico`.
- Un enlace sin `?modo=` es siempre individual: cada uno juega en su pantalla y no se pregunta nada. El modo de una sola pantalla es para usar en la planta: `?modo=grupo` (todos juntos, sin equipos), `?modo=equipos` (en dos equipos) o `?modo=elegir` (se pregunta al empezar).
- `?envio=` pone una etiqueta para ver ese envío por separado en el tablero.

Ejemplo: `https://ruta-de-la-lana.netlify.app/?perfil=productor&envio=remate-marzo`

## Recorrido corto para chicos

El perfil "Soy chico" tiene un recorrido más breve:

- Las trivias son de 4 preguntas (se cambia en la planilla, pestaña Ajustes, con la clave `preguntas_por_trivia_chicos`).
- El diploma se gana con cinco estaciones: La oveja, La esquila, La planta, Después del top y La lana. Las demás aparecen como "Extra".
- El sello también se gana jugando: los recorridos, la mesa de vellones, el galpón y "¿Qué lana para cada cosa?".
