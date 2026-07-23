#!/bin/bash
node -e "
const fs = require('fs');
const path = '/var/www/planaaiWebsite/backend/.env';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL=\"postgres://planaai_user:planaai_password@168.110.101.236:5432/planaai_db\"');
fs.writeFileSync(path, content);
console.log('Updated .env for Production DB');
"
