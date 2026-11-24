// Devuelve los números del tablero de impacto de "La ruta de la lana".
// Necesita DATABASE_URL (Neon) y TABLERO_CLAVE (la clave que se pide en /tablero).
import { neon } from "@neondatabase/serverless";
import { timingSafeEqual, createHash } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const ZONA = "America/Montevideo";
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const huella = (t) => createHash("sha256").update(String(t)).digest();

export default async (req) => {
  const clave = process.env.TABLERO_CLAVE;
  if (!clave) return json({ error: "sin_clave" }, 503);
  const dada = req.headers.get("x-clave") || "";
  if (!dada || !timingSafeEqual(huella(dada), huella(clave))) return json({ error: "clave" }, 401);

  const u = new URL(req.url);
  const desde = FECHA.test(u.searchParams.get("desde") || "") ? u.searchParams.get("desde") : "2000-01-01";
  const hasta = FECHA.test(u.searchParams.get("hasta") || "") ? u.searchParams.get("hasta") : "2999-12-31";

  // Todo se filtra por la fecha (hora de Uruguay) en que la persona o el grupo empezó a jugar.
  const [totales, dias, perfiles, sellos, juegos, preguntas, personas, grupos, envios] = await Promise.all([
    sql`
      with p as (
        select * from participantes
        where (creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      ), e as (
        select e.* from eventos e join p on p.id = e.participante_id
      )
      select
        (select count(*) from p)::int as partidas,
        (select count(*) from p where modo = 'individual')::int as individuales,
        (select count(*) from p where modo = 'grupo')::int as grupos,
        (select coalesce(sum(case when modo = 'grupo' then greatest(coalesce(tam_grupo, 1), 1) else 1 end), 0) from p)::int as personas,
        (select count(*) from p where consentimiento)::int as registrados,
        (select count(*) from p where token is not null)::int as invitados,
        (select count(distinct participante_id) from e)::int as activos,
        (select count(distinct participante_id) from e where tipo = 'sello')::int as con_sello,
        (select count(distinct participante_id) from e where tipo = 'diploma')::int as diplomas,
        (select count(*) from e where tipo = 'respuesta')::int as respuestas,
        (select count(*) from e where tipo = 'respuesta' and (detalle->>'bien')::boolean)::int as aciertos`,
    sql`
      select to_char((creado at time zone ${ZONA})::date, 'YYYY-MM-DD') as dia,
             count(*)::int as partidas,
             sum(case when modo = 'grupo' then greatest(coalesce(tam_grupo, 1), 1) else 1 end)::int as personas
      from participantes
      where (creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by 1 order by 1`,
    sql`
      select coalesce(perfil, 'Sin perfil') as perfil, modo, count(*)::int as partidas,
             sum(case when modo = 'grupo' then greatest(coalesce(tam_grupo, 1), 1) else 1 end)::int as personas
      from participantes
      where (creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by 1, 2 order by 3 desc`,
    sql`
      select e.estacion, count(distinct e.participante_id)::int as partidas
      from eventos e join participantes p on p.id = e.participante_id
      where e.tipo = 'sello'
        and (p.creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by 1 order by 2 desc`,
    sql`
      select e.estacion, count(*)::int as veces, count(distinct e.participante_id)::int as partidas,
             sum(e.aciertos)::int as aciertos, sum(e.total)::int as total
      from eventos e join participantes p on p.id = e.participante_id
      where e.tipo = 'juego'
        and (p.creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by 1 order by 2 desc`,
    sql`
      select e.detalle->>'pregunta' as pregunta, e.estacion, count(*)::int as respuestas,
             count(*) filter (where not (e.detalle->>'bien')::boolean)::int as errores
      from eventos e join participantes p on p.id = e.participante_id
      where e.tipo = 'respuesta' and e.detalle ? 'pregunta'
        and (p.creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by 1, 2`,
    sql`
      select p.nombre, p.correo, p.perfil, (p.token is not null) as invitado,
             to_char(p.creado at time zone ${ZONA}, 'YYYY-MM-DD HH24:MI') as creado,
             count(distinct e.estacion) filter (where e.tipo = 'sello')::int as sellos,
             coalesce(bool_or(e.tipo = 'diploma'), false) as diploma
      from participantes p left join eventos e on e.participante_id = p.id
      where p.consentimiento and p.modo = 'individual'
        and (p.creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by p.id order by p.creado desc limit 500`,
    sql`
      select p.grupo, p.tam_grupo, p.perfil,
             to_char(p.creado at time zone ${ZONA}, 'YYYY-MM-DD HH24:MI') as creado,
             count(distinct e.estacion) filter (where e.tipo = 'sello')::int as sellos,
             coalesce(bool_or(e.tipo = 'diploma'), false) as diploma
      from participantes p left join eventos e on e.participante_id = p.id
      where p.modo = 'grupo'
        and (p.creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by p.id order by p.creado desc limit 500`,
    sql`
      select coalesce(p.envio, 'Sin etiqueta') as envio, count(distinct p.id)::int as partidas,
             count(distinct p.id) filter (where e.tipo = 'sello')::int as con_sello,
             count(distinct p.id) filter (where e.tipo = 'diploma')::int as diplomas
      from participantes p left join eventos e on e.participante_id = p.id
      where (p.creado at time zone ${ZONA})::date between ${desde}::date and ${hasta}::date
      group by 1 order by 2 desc limit 100`,
  ]);

  return json({ totales: totales[0], dias, perfiles, sellos, juegos, preguntas, personas, grupos, envios });
};

export const config = { path: "/api/tablero" };
