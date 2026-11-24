#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Una pasada del semáforo de privacidad (ADR 0006): pone al día /sitio (un clon aparte del
# repositorio), inspecciona lo que toca con el código de /proyecto, escribe la hoja del
# repositorio y, si cambian los datos, los sube a GitHub. Los argumentos van a semaforo_vce.py.
set -euo pipefail
export GIT_SSH_COMMAND="ssh -i /claves/id_ed25519 -o IdentitiesOnly=yes -o UserKnownHostsFile=/claves/known_hosts"
cd /sitio
if [ ! -d .git ]; then
  git clone -q git@github.com:guia-privacidad-edu/guia-privacidad-edu.github.io.git .
fi
git fetch -q origin main
git reset -q --hard origin/main   # aquí solo escribe esta pasada: nada que perder
/opt/pw/bin/python /proyecto/scripts/semaforo_vce.py --datos /sitio/datos "$@"
if [ -n "$(git status --porcelain -- datos/)" ]; then
  git add datos/auditoria-vce.json datos/vce-evaluadas.json
  git -c user.name="Semáforo de privacidad (NAS)" -c user.email="nas@montflorit.ddnsfree.com" \
    commit -q -m "Semáforo de privacidad del Repositorio VCE: pasada del $(date +%F)"
  git push -q origin HEAD:main
  echo "Datos subidos."
else
  echo "Sin cambios en los datos."
fi
