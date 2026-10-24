# syntax=docker/dockerfile:1
# ===========================================================
# API REST Laravel 13 (PHP 8.3) con PHP-FPM + Nginx
# ===========================================================

# -----------------------------------------------------------
# Etapa 1: Dependencias de Composer
# Usa la MISMA version de PHP que produccion para que Composer
# resuelva paquetes compatibles. Composer, git y unzip
# nunca llegan a la imagen final.
# -----------------------------------------------------------
FROM php:8.3-cli-alpine AS vendor
RUN apk add --no-cache git unzip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app

# Primero solo los manifiestos: esta capa queda en cache
# mientras composer.json/composer.lock no cambien.
COPY composer.json composer.lock* ./
RUN --mount=type=cache,target=/root/.composer/cache \
    composer install \
      --no-dev \
      --no-interaction \
      --no-progress \
      --prefer-dist \
      --no-scripts \
      --no-autoloader

# Luego el codigo, para generar el autoload optimizado
COPY . .
RUN composer dump-autoload --no-dev --optimize --no-scripts

# -----------------------------------------------------------
# Etapa 2: Runtime (imagen final de produccion)
# -----------------------------------------------------------
FROM php:8.3-fpm-alpine AS runtime

# Parches de seguridad de Alpine + Nginx como proxy inverso + pdo_mysql y opcache.
# Las herramientas de compilacion se instalan y se borran en la misma capa.
RUN apk upgrade --no-cache && apk add --no-cache nginx \
 && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
 && docker-php-ext-install -j"$(nproc)" pdo_mysql opcache \
 && apk del .build-deps \
 && rm -rf /tmp/* /var/cache/apk/*

# Verificacion: el build falla si falta alguna extension requerida.
# mbstring, openssl, tokenizer, xml, ctype y json ya vienen en la imagen oficial.
RUN for ext in pdo_mysql mbstring openssl tokenizer xml ctype json; do \
      php -m | grep -qi "^${ext}$" || { echo "Falta la extension: ${ext}"; exit 1; }; \
    done

# Configuracion de produccion de PHP, OPcache y Nginx
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php/zz-production.ini $PHP_INI_DIR/conf.d/zz-production.ini
COPY docker/nginx/default.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html

# Codigo de la aplicacion (propiedad de root, solo lectura para PHP-FPM)
COPY . .
# De la etapa de build se copia UNICAMENTE vendor/
COPY --from=vendor /app/vendor ./vendor

# Solo storage y bootstrap/cache son escribibles por www-data
RUN php artisan package:discover --ansi \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod -R 775 storage bootstrap/cache

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8000/up >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
