// Recibe los registros de uso de "La ruta de la lana" y los guarda en Neon.
// Necesita la variable de entorno DATABASE_URL (cadena de conexión de Neon).
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const TIPOS = ["respuesta", "trivia", "sello", "juego", "diploma", "opinion"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
const texto = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const entero = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "json" }, 400); }

  if (b.accion === "alta") {
    // Un enlace personal solo vale si el código existe en la tabla invitaciones.
    let token = texto(b.token, 64);
    if (token) {
      const hay = await sql`select 1 from invitaciones where token = ${token}`;
      if (!hay.length) token = null;
    }
    const consiente = b.consentimiento === true;
    const modo = b.modo === "grupo" ? "grupo" : "individual";
    const fila = await sql`
      insert into participantes (token, envio, nombre, correo, perfil, modo, grupo, tam_grupo, consentimiento)
      values (${token}, ${texto(b.envio, 60)},
              ${consiente ? texto(b.nombre, 120) : null},
              ${consiente ? texto(b.correo, 200) : null},
              ${texto(b.perfil, 60)}, ${modo},
              ${modo === "grupo" ? texto(b.grupo, 120) : null},
              ${modo === "grupo" ? entero(b.tam_grupo, 999) : null},
              ${consiente})
      returning id`;
    return json({ id: fila[0].id });
  }

  if (b.accion === "evento") {
    if (!UUID.test(b.participante || "") || !TIPOS.includes(b.tipo)) return json({ error: "datos" }, 400);
    const detalle = b.detalle && JSON.stringify(b.detalle).length <= 2000 ? JSON.stringify(b.detalle) : null;
    try {
      await sql`
        insert into eventos (participante_id, tipo, estacion, aciertos, total, detalle)
        values (${b.participante}, ${b.tipo}, ${texto(b.estacion, 60)},
                ${entero(b.aciertos, 1000)}, ${entero(b.total, 1000)}, ${detalle}::jsonb)`;
    } catch (e) {
      return json({ error: "participante" }, 404);
    }
    return json({ ok: true });
  }
  if (b.accion === "revision") {
    // Comentarios del modo revisor (?revisor=1). Se leen en el tablero.
    const marca = texto(b.marca, 40), comentario = texto(b.comentario, 1500);
    if (!marca && !comentario) return json({ error: "vacio" }, 400);
    await sql`
      insert into revisiones (participante_id, revisor, perfil, pantalla, ref, titulo, marca, comentario)
      values (${UUID.test(b.participante || "") ? b.participante : null}, ${texto(b.revisor, 60)}, ${texto(b.perfil, 60)},
              ${texto(b.pantalla, 80)}, ${texto(b.ref, 60)}, ${texto(b.titulo, 300)}, ${marca}, ${comentario})`;
    return json({ ok: true });
  }
  return json({ error: "accion" }, 400);
};

export const config = { path: "/api/evento" };
