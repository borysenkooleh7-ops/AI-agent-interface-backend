# Railway Deployment Troubleshooting

## ⚠️ CRITICAL: Server Not Responding (Connection Timeout)

**If you get "Connection closed" or timeout errors, your server is NOT running on Railway.**

## Immediate Action Checklist

1. ✅ **Check Railway Dashboard → Service Status**
   - Is the service showing **green/running**?
   - If red/stopped, click "Restart" or "Deploy"

2. ✅ **Check Railway Logs**
   - Go to: Railway Dashboard → Your Service → **Logs** tab
   - Look for:
     - ❌ Error messages (red text)
     - ❌ "Server crashed" or exit codes
     - ✅ "Server starting..."
     - ✅ "✅ Webhooks routes registered"
     - ✅ "Status: Running ✓"

3. ✅ **Verify Latest Code is Deployed**
   - Ensure `webhooks.routes.ts` exists and is deployed
   - Check that `server.ts` includes: `app.use('/api/webhooks', webhooksRoutes);`

4. ✅ **Check Build Success**
   - In Railway logs, verify:
     - `npm install` completed
     - `npm run build` completed (no TypeScript errors)
     - `dist/server.js` exists

5. ✅ **Verify Environment Variables**
   - `DATABASE_URL` is set (required)
   - `JWT_SECRET` is set (required)
   - `NODE_ENV=production` (optional but recommended)
   - `PORT` is automatically set by Railway (don't override)

## Common Deployment Failures

### Failure: Database Connection Error
**Symptoms:** Server crashes on startup, logs show Prisma connection errors

**Fix:**
```bash
# Verify DATABASE_URL in Railway environment variables
# Format: postgresql://user:password@host:port/database
# Railway should auto-set this if you connected a PostgreSQL service
```

### Failure: Build Failed
**Symptoms:** No `dist/server.js` file, TypeScript compilation errors

**Fix:**
- Check Railway build logs for TypeScript errors
- Ensure all dependencies are in `package.json`
- Verify `tsconfig.json` is correct

### Failure: Server Not Binding to Port
**Symptoms:** Server starts but no traffic reaches it

**Fix:** ✅ **FIXED** - Server now binds to `0.0.0.0` explicitly (see latest code)

## 1. Check Railway Deployment Status

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project: `duxfit-production`
3. Check if the service is **running** (green status)
4. Check the **Logs** tab for any startup errors

## 2. Verify Server is Running

### PowerShell Commands (Windows):

```powershell
# Test health endpoint first
Invoke-WebRequest -Uri "https://duxfit-production.up.railway.app/health" -Method GET -UseBasicParsing

# If health works, test webhook endpoint
$url = "https://duxfit-production.up.railway.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=duxfit_token_20251105&hub.challenge=123456"
Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing

# Alternative: Use curl.exe (if available)
curl.exe "https://duxfit-production.up.railway.app/health"
```

### If using Git Bash or WSL:
```bash
curl "https://duxfit-production.up.railway.app/health"
curl "https://duxfit-production.up.railway.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=duxfit_token_20251105&hub.challenge=123456"
```

## 3. Common Issues and Fixes

### Issue: Server Not Starting
**Symptoms:** No response, connection timeout

**Fix:**
1. Check Railway logs for errors
2. Verify `PORT` environment variable is set (Railway sets this automatically)
3. Ensure `npm run build` completes successfully
4. Verify `dist/server.js` exists after build

### Issue: Database Connection Failed
**Symptoms:** Server crashes on startup

**Fix:**
1. Verify `DATABASE_URL` is set in Railway environment variables
2. Check if database is accessible from Railway
3. Ensure migrations run: `npm run prisma:migrate:deploy` should run in `prestart`

### Issue: Missing Environment Variables
**Symptoms:** Server starts but webhook verification fails

**Fix:**
1. Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in Railway environment variables
2. Or ensure the token is set in the database via the admin API

## 4. Verify Build Process

Railway should automatically:
1. Run `npm install` (which triggers `postinstall: prisma generate`)
2. Run `npm run build` (compiles TypeScript)
3. Run `npm start` (which runs `prestart: prisma migrate deploy` then starts server)

Check Railway build logs to ensure all steps complete successfully.

## 5. Testing Webhook Verification

Once the server is responding:

```powershell
# PowerShell
$verifyUrl = "https://duxfit-production.up.railway.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=duxfit_token_20251105&hub.challenge=123456"
$response = Invoke-WebRequest -Uri $verifyUrl -Method GET -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"
```

Expected response: Status 200, content should be `123456` (the challenge value)

## 6. Railway Environment Variables Checklist

Ensure these are set in Railway:
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `JWT_SECRET` - For authentication
- ✅ `NODE_ENV=production`
- ✅ `WHATSAPP_WEBHOOK_VERIFY_TOKEN` - Optional (can be set in DB)
- ✅ `PORT` - Railway sets this automatically, don't override

## 7. Check Railway Logs

1. Go to Railway Dashboard → Your Service → Logs
2. Look for:
   - ✅ `✅ Webhooks routes registered at /api/webhooks`
   - ✅ `Server starting...`
   - ✅ `Status: Running ✓`
   - ❌ Any error messages

## 8. Manual Deployment Check

If automatic deployment isn't working:

1. **Push to GitHub** (if connected):
   ```bash
   git add .
   git commit -m "Add webhooks route"
   git push
   ```

2. **Or redeploy manually** in Railway dashboard:
   - Go to Deployments tab
   - Click "Redeploy" or trigger a new deployment

## 9. Quick Health Check Script

Create a test script to verify deployment:

```powershell
# test-railway.ps1
$baseUrl = "https://duxfit-production.up.railway.app"

Write-Host "Testing Railway deployment..." -ForegroundColor Yellow

# Test health endpoint
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -UseBasicParsing
    Write-Host "✅ Health check: $($health.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($health.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test webhook endpoint
try {
    $webhookUrl = "$baseUrl/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=duxfit_token_20251105&hub.challenge=123456"
    $webhook = Invoke-WebRequest -Uri $webhookUrl -Method GET -UseBasicParsing
    Write-Host "✅ Webhook verification: $($webhook.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($webhook.Content)" -ForegroundColor Gray
    
    if ($webhook.Content -eq "123456") {
        Write-Host "✅ Webhook verification successful!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Webhook verification returned unexpected value" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Webhook test failed: $_" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```

Run with: `powershell -ExecutionPolicy Bypass -File test-railway.ps1`

