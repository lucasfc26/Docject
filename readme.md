# 1. Copiar e preencher as variáveis

cp .env.prod.example .env.prod
nano .env.prod

# 2. Subir o stack

docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# Criar diretórios

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# Verificar se nginx.conf já inclui sites-enabled

grep -q "sites-enabled" /etc/nginx/nginx.conf && echo "OK" || echo "FALTA include"

echo ' include /etc/nginx/sites-enabled/\*;' >> /etc/nginx/nginx.conf

# 3. Configurar Nginx do host

cp nginx-vps.conf.example /etc/nginx/sites-available/dj.maselcorp.com.br
ln -s /etc/nginx/sites-available/dj.maselcorp.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 4. Gerar SSL

certbot --nginx -d dj.maselcorp.com.br

docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
docker exec projectfy_backend npx prisma db push
docker compose -f docker-compose.prod.yml --env-file .env.prod restart backend
