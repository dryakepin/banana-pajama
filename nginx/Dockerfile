# Production Nginx with SSL support
FROM nginx:alpine

# Install openssl for SSL certificate generation
RUN apk add --no-cache openssl

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY production.conf /etc/nginx/conf.d/production.conf

# Create SSL directory
RUN mkdir -p /etc/ssl/certs

# Create self-signed certificate for development (replace with real certs in production)
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/certs/banana-pajama.key \
    -out /etc/ssl/certs/banana-pajama.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]