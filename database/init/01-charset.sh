#!/bin/bash
# Se ejecuta solo la primera vez que se crea el volumen de datos.
# Asegura utf8mb4 (emojis y acentos en los mensajes del chat).
set -e
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
ALTER DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SQL
