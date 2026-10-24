#!/bin/sh
set -e

cd /var/www/html

# La cache de configuracion/rutas/vistas se genera en runtime porque
# las variables de entorno llegan desde docker-compose, no del build.
php artisan optimize

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
