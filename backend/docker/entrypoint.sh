#!/bin/sh
set -e

cd /var/www/html

# Sin APP_KEY (por ejemplo en la demo) se genera una temporal: las sesiones se invalidan al reiniciar
if [ -z "$APP_KEY" ]; then
  echo "APP_KEY no definida: se genera una temporal."
  APP_KEY="base64:$(head -c 32 /dev/urandom | base64)"
  export APP_KEY
fi

# Con SQLite (demo) se crea el archivo y se da permiso de escritura a PHP-FPM
if [ "$DB_CONNECTION" = "sqlite" ]; then
  DB_FILE="${DB_DATABASE:-/var/www/html/database/database.sqlite}"
  mkdir -p "$(dirname "$DB_FILE")"
  [ -f "$DB_FILE" ] || touch "$DB_FILE"
  chown www-data:www-data "$DB_FILE" "$(dirname "$DB_FILE")"
fi

# La cache de configuracion, rutas y eventos se genera en runtime porque
# las variables de entorno llegan desde docker-compose, no del build.
# (La API no tiene vistas Blade, por eso no se usa "optimize", que tambien compila vistas.)
php artisan config:cache
php artisan route:cache
php artisan event:cache

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  php artisan migrate --force
fi

# Seeder idempotente: solo inserta datos si la base esta vacia
if [ "${SEED_DATABASE:-true}" = "true" ]; then
  php artisan db:seed --force
fi

# Los archivos de cache generados arriba quedan legibles para www-data
chown -R www-data:www-data storage bootstrap/cache

# PHP-FPM en segundo plano, Nginx en primer plano (PID 1)
php-fpm -D
exec nginx -g 'daemon off;'
