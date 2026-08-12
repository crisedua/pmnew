-- ============================================================
-- CARGA INICIAL DE LA BITÁCORA — Emprendetón Academia
--
-- Inserta las 9 filas de contacto con universidades en la bitácora
-- de la iniciativa "Diseno Sprint / Bootcamp / Emprendeton Academia".
--
-- Busca la iniciativa por nombre, así que no necesitas el UUID.
-- Sólo inserta si esa iniciativa aún no tiene filas de bitácora
-- (para no duplicar si lo ejecutas dos veces).
--
-- Requiere: supabase-bitacora.sql + supabase-bitacora-project.sql
-- Ejecuta en Supabase -> SQL Editor.
-- ============================================================

INSERT INTO public.bitacora_entries
    (project_id, universidad, nombre, modalidad, disponibilidad, estado, notas, posicion)
SELECT p.id, v.universidad, v.nombre, v.modalidad, NULL, v.estado, v.notas, v.posicion
FROM public.projects p
CROSS JOIN (VALUES
    (0, 'PUCV', 'Macarena Rosenkranz', 'Virtual', 'contactado, en espero respuesta',
        E'2/7 contactada nuevamente, no respuesta'),
    (1, 'USM', 'Vanessa Mella', 'Virtual', 'nos reunimos',
        E'29/ ME ENVIO LISTADO DE ALUMNOS\n28/7 solicite nombre alumnos para capsacitarlos\nVanessa quedo la primera semana de Agosto seleccionar alumnos y segunda semana capacitarlos'),
    (2, 'UV', 'CRISTIÁN OYANEDEL', 'Virtual', 'nos reunimos',
        E'29/7 ME ENVIO LISTADO DE Alumnos\n28/7 solicite nombre alumnos para capacitarlos\nReunión 7/6 Va a contactar directores carreras para buscar alum,nos. se comprometio para primera semana agosto ya que los alumnos están en vacaciones'),
    (3, 'Duoc UC', 'Verónica Vidal', 'Virtual', 'nos reunimos',
        E'29/7 a perfecto 👌 buena fecha a finales de agosto!!\nEl tema es que como no estoy en la oficina, no tengo acceso a la información de estudiantes para seleccionar a los 2 que me piden ahora.\n\nAdemás, los alumnos están con vacaciones de invierno y retoman el segundo semestre el 10 de agosto.\nPor lo cual contactarme con ellos, es complejo ahora\n28/7 solicite nombre alumnos para capacitarlos\nPidio cuando tengamos fecha y lugar , hara llamado a alumnos'),
    (4, 'AIEP', 'Felipe Muñoz', 'Virtual', 'contactado, en espero respuesta',
        E'28/7 solicite nombre alumnos para capacitarlos\n2/7 contactado nuevamente, no respuesta'),
    (5, 'UST', 'Francisco Rivillo', NULL, 'nos reunimos',
        E'28/7 solicite nombre alumnos para capacitarlos\nnos reunimos 7/6 el va a pasar información a UST ya que él ahora trabaja en Encargado de Transferencia Tecnológica y Conocimiento de la USM. El seguira rol de liasion con UST'),
    (6, 'UVM', 'Javier Moya', 'Virtual', 'nos reunimos',
        E'28/7 solicite nombre alumnos para capacitarlos\nreunión 7/7. Comprometido: "cuenten con nosotros para fines de agosto", pero debe informar a Daniel Tello y escalar a la escuela de ingeniería\nPropuso equipos mixtos: 1 estudiante de diseño + 1 de ingeniería; si no resulta, arma el equipo solo con ingeniería'),
    (7, 'INACAP', 'Natalia Madrid', NULL, 'nos reunimos',
        E'29/ rrspondio revisare segun disponobilidad y envio los datos\n28/7 solicite nombre alumnos para capacitarlos\nreunión 7/7.. Confirmó 2 estudiantes de inmediato, ella misma hará la selección interna\nPrefiere fines de agosto (estudiantes vuelven de vacaciones, su agenda de inicios de agosto está llena)\nAcordado: evento de 2 días, 4 horas de capacitación no-code previa en sesiones, sede tentativa Mutual de Seguros\nQuiere acompañar a los estudiantes en el evento para documentar con fotos y testimonios'),
    (8, 'UDLA', 'Maria Ignacia Díaz', NULL, 'nos reunimos',
        E'29/7 respondio recopilo los datos y los envio\n28/7 solicite nombre alumnos para capacitarlos\nva buscar alumno/as y me dara conocer la segunda semana de julio')
) AS v(posicion, universidad, nombre, modalidad, estado, notas)
WHERE p.name ILIKE '%Emprendeton Academia%'
  AND NOT EXISTS (
      SELECT 1 FROM public.bitacora_entries b WHERE b.project_id = p.id
  );

-- Verifica el resultado:
--   SELECT universidad, nombre, estado FROM public.bitacora_entries
--   WHERE project_id = (SELECT id FROM public.projects WHERE name ILIKE '%Emprendeton Academia%')
--   ORDER BY posicion;
