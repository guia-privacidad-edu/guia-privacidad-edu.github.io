#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# El reloj del semáforo de privacidad en su contenedor del NAS (ADR 0006).
# Desde las 3:30, una pasada al día (nas/noche.sh); el domingo, con todas las aplicaciones.
# Si falla, otro intento a la vuelta siguiente; tras el tercer fallo, un aviso a Juanjo y
# nada más ese día. Lo hecho se apunta en /estado, así que reiniciar no repite nada.
set -u
while true; do
  hoy=$(date +%F)
  hora=$(( 10#$(date +%H) * 60 + 10#$(date +%M) ))
  hecho=/estado/$hoy.hecho
  intentos=/estado/$hoy.intentos
  if [ "$hora" -ge 210 ] && [ ! -f "$hecho" ]; then
    n=$(cat "$intentos" 2>/dev/null || echo 0)
    if [ "$n" -lt 3 ]; then
      echo $((n + 1)) > "$intentos"
      args=()
      [ "$(date +%u)" = 7 ] && args+=(--todas)
      if /proyecto/nas/noche.sh "${args[@]}" > "/estado/$hoy.log" 2>&1; then
        touch "$hecho"
      elif [ "$((n + 1))" -ge 3 ]; then
        avisar-juanjo --de "Semáforo de privacidad" \
          "La pasada de hoy ha fallado tres veces. El final del registro: $(tail -5 "/estado/$hoy.log")" \
          >/dev/null 2>&1 || true
      fi
    fi
  fi
  find /estado -name '*.log' -mtime +30 -delete 2>/dev/null
  sleep 300
done
