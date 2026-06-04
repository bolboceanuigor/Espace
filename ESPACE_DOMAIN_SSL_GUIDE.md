# ESPACE_DOMAIN_SSL_GUIDE

## Recomandare domeniu canonic

**Canonic recomandat: `https://www.espace.md`**

### De ce

- aliniaza `APP_URL` cu cerinta ta explicita
- simplifica linkurile publice si emailurile
- permite redirect clar de pe apex catre `www`
- pastreaza consistenta pentru cookies, password reset links, invoice links si return URLs

## Impactul alegerii

- `APP_URL`: `https://www.espace.md`
- `NEXT_PUBLIC_APP_URL`: `https://www.espace.md`
- cookies: `COOKIE_DOMAIN=.espace.md`
- payment return URLs: folosesc `https://www.espace.md/...`
- webhook URLs: folosesc `https://www.espace.md/api/...`
- CORS: include `https://www.espace.md` si optional `https://espace.md`

## Redirects recomandate

- `http://espace.md/*` -> `https://www.espace.md/*` (`301`)
- `http://www.espace.md/*` -> `https://www.espace.md/*` (`301`)
- `https://espace.md/*` -> `https://www.espace.md/*` (`301`)

Toate trebuie sa pastreze path si query string.

## Nginx exemplu pentru Espace

Espace nu este Laravel/PHP, deci nu foloseste `root /public` + `php-fpm`. Configul corect este reverse proxy catre frontend Next.js si backend NestJS.

```nginx
server {
    listen 80;
    server_name espace.md www.espace.md;
    return 301 https://www.espace.md$request_uri;
}

server {
    listen 443 ssl http2;
    server_name espace.md;

    ssl_certificate     /etc/letsencrypt/live/www.espace.md/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.espace.md/privkey.pem;

    return 301 https://www.espace.md$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.espace.md;

    ssl_certificate     /etc/letsencrypt/live/www.espace.md/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.espace.md/privkey.pem;

    client_max_body_size 20m;

    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Apache exemplu

Tot reverse proxy, nu PHP-FPM:

```apache
<VirtualHost *:80>
    ServerName espace.md
    ServerAlias www.espace.md
    Redirect permanent / https://www.espace.md/
</VirtualHost>

<VirtualHost *:443>
    ServerName espace.md
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/www.espace.md/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/www.espace.md/privkey.pem
    Redirect permanent / https://www.espace.md/
</VirtualHost>

<VirtualHost *:443>
    ServerName www.espace.md
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/www.espace.md/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/www.espace.md/privkey.pem

    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:4000/api/
    ProxyPassReverse /api/ http://127.0.0.1:4000/api/
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

## SSL checklist

- certificat valid pentru `www.espace.md`
- certificat valid si pentru `espace.md` daca faci redirect de pe apex
- auto-renew activ
- testare expirare
- redirect automat HTTP -> HTTPS
- verificare mixed content dupa deploy

## Variabile `.env` afectate

- `APP_URL=https://www.espace.md`
- `FRONTEND_URL=https://www.espace.md`
- `API_URL=https://www.espace.md/api`
- `NEXT_PUBLIC_APP_URL=https://www.espace.md`
- `NEXT_PUBLIC_API_URL=https://www.espace.md/api`
- `COOKIE_DOMAIN=.espace.md`
- `CORS_ORIGIN=https://www.espace.md,https://espace.md`
- `GOOGLE_CALLBACK_URL=https://www.espace.md/api/auth/google/callback`

## Payments

Pentru providerul ales trebuie configurate in dashboard:

- success URL
- cancel URL
- webhook URL
- live vs sandbox mode

Recomandare actuala:

- nu pune live keys pana nu finalizezi providerul real
- pastreaza sandbox / disabled pana trece testul complet

## Smoke tests dupa DNS/SSL

- homepage
- login
- reset password link
- dashboard
- CSS/JS assets
- upload/download
- email links
- payment redirect
- webhook endpoint reachability
- fara mixed content

## Riscuri

- daca alegi apex si `www` in paralel fara redirect clar, apar probleme de cookies si linkuri
- daca `COOKIE_DOMAIN` nu este coerent, loginul poate deveni instabil
- daca `APP_URL` nu este canonic, emailurile si reset links vor avea host gresit
