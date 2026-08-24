#!/bin/bash
# Add Odoo websocket (bus) proxying to the POS nginx vhost so the POS terminal
# receives live notifications (online-order popup + kitchen-ticket print).
# Safe: backs up first, and only reloads nginx if the new config validates.
F=/etc/nginx/sites-enabled/pos.sedapeatery.com.au.conf
B="${F}.bak.$(date +%s)"
cp "$F" "$B" || { echo "cannot read $F"; exit 1; }

python3 - "$F" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if "/websocket" in s:
    print("websocket location already present — no change")
    sys.exit(0)
block = '''    location /websocket {
        proxy_pass http://127.0.0.1:8072;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

'''
if "    location / {" not in s:
    print("could not find 'location / {' to anchor insert — aborting")
    sys.exit(2)
s = s.replace("    location / {", block + "    location / {", 1)
open(p, "w").write(s)
print("added /websocket location")
PY

if nginx -t; then
    systemctl reload nginx && echo "=== NGINX RELOADED OK — now reload the POS on the terminal ==="
else
    echo "=== nginx -t FAILED — restoring original, nothing changed ==="
    cp "$B" "$F"
    exit 1
fi
