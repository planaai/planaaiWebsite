#!/bin/bash
node -e "
const fs = require('fs');
const path = '/var/www/planaaiWebsite/backend/.env';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL=\"postgres://postgres:postgres@localhost:51218/template1?sslmode=disable&connection_limit=10&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0\"');
fs.writeFileSync(path, content);
console.log('Updated .env');
"
