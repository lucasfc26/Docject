# 1. Copiar e preencher as variáveis

cp .env.prod.example .env.prod
nano .env.prod

# 2. Subir o stack

docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 3. Configurar Nginx do host

cp nginx-vps.conf.example /etc/nginx/sites-available/dj.maselcorp.com.br
ln -s /etc/nginx/sites-available/dj.maselcorp.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 4. Gerar SSL

certbot --nginx -d dj.maselcorp.com.br
