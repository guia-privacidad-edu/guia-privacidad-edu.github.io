# SPDX-License-Identifier: AGPL-3.0-or-later
# El semáforo de privacidad del Repositorio VCE, cada noche en el NAS (ADR 0006).
# Parte de la imagen del boletín semanal, que ya trae Python, git y Playwright con su
# Chromium (/opt/pw); le añade el cliente SSH, para subir los datos con la clave de
# despliegue del repositorio.
FROM boletin-semanal:local
USER root
RUN apt-get update && apt-get install -y --no-install-recommends openssh-client \
    && rm -rf /var/lib/apt/lists/*
USER 1000:10
