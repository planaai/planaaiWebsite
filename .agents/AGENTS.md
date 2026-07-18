# Project Rules for AI Agents

## 🚨 CRITICAL: Protected Server Directories

### `backend/data/` — NEVER MODIFY

The `backend/data/` directory contains **live production data** that is maintained on the server.

**Rules:**
1. **NEVER modify, delete, overwrite, or replace** any files inside `backend/data/` on the server.
2. **NEVER run commands** that would alter the contents of `backend/data/` on the remote server (e.g., `scp`, `rsync`, `rm`, `cp`, `mv` targeting this directory).
3. **NEVER include `backend/data/`** in any file transfer, sync, or deployment operation to the server.
4. When deploying the backend, **always exclude `backend/data/`** from any upload or sync commands.
5. If using `rsync`, always include `--exclude='data/'` or `--exclude='backend/data/'`.
6. If using `scp` or manual file copy, **skip the `data/` directory entirely**.
7. **NEVER run `git checkout`, `git reset`, or `git clean`** on `backend/data/` on the server.

### Why?
- `backend/data/` contains live production data (student records, mapped data, schema configurations, backups).
- This data is **different on the server** from the local development copy.
- Overwriting it causes **irreversible data loss**.

### Safe Deployment Procedure
When deploying the backend to the server:
1. Use the existing `deploy/scripts/update_backend.sh` script which has built-in data protection.
2. If manually deploying, **always exclude** the `backend/data/` directory.
3. After deployment, **verify** that `backend/data/` was NOT modified by checking file timestamps.

### Example Safe Commands
```bash
# ✅ SAFE: rsync with exclusion
rsync -avz --exclude='data/' ./backend/ server:/path/to/backend/

# ✅ SAFE: Use the update script
ssh server 'cd /path/to/project && ./deploy/scripts/update_backend.sh'

# ❌ DANGEROUS: Do NOT do this
scp -r ./backend/ server:/path/to/backend/           # Overwrites data/
rsync -avz ./backend/ server:/path/to/backend/        # Overwrites data/
```

## Other Protected Paths
- `backend/prisma/*.db` — Production database files, do not overwrite.
- `backend/uploads/` — User-uploaded files, do not overwrite.

## Deployment Notes
- Server key is located at: `C:\Users\also1\Documents\ba_archive\ba_archive\server_key\`
- Always use the deploy scripts when possible.
- After deployment, verify the server is running correctly with `pm2 status`.
