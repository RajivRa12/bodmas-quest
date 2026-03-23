FROM php:8.2-apache

# Enable Apache mod_rewrite
RUN a2enmod rewrite headers

# Set working directory
WORKDIR /var/www/html

# Copy all project files
COPY . .

# Make scores.json writable if it exists, or create it
RUN touch scores.json && chmod 666 scores.json

# Apache config for clean URLs and CORS
RUN echo '<Directory /var/www/html>\n\
    Options Indexes FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>' >> /etc/apache2/apache2.conf

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod 666 /var/www/html/scores.json

EXPOSE 80
CMD ["apache2-foreground"]
