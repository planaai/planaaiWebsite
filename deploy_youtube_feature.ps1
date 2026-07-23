$KeyPath = "C:\Users\also1\Documents\ba_archive\ba_archive\server_key\ssh-key-2026-07-01.key"
$Server = "ubuntu@140.245.70.15"
$BasePath = "/var/www/planaaiWebsite"

$Files = @(
    "backend\prisma\schema.prisma",
    "backend\routes\raids.js",
    "client\src\types\raid.ts",
    "client\src\components\raid\RaidWriteForm.tsx",
    "client\src\components\raid\RaidPartyCard.tsx",
    "client\src\components\TurnstileWidget.tsx",
    "client\src\app\register\page.tsx",
    "client\package.json",
    "client\package-lock.json"
)

foreach ($File in $Files) {
    $LinuxPath = $File -replace '\\', '/'
    $TempTarget = "${Server}:/tmp/deploy_$($File.Split('\')[-1])"
    
    Write-Host "Uploading $File..."
    scp -i $KeyPath -o StrictHostKeyChecking=no $File $TempTarget
    
    $SshCmd = "sudo mv /tmp/deploy_$($File.Split('\')[-1]) ${BasePath}/${LinuxPath} && sudo chown -R ubuntu:ubuntu ${BasePath}/${LinuxPath}"
    ssh -i $KeyPath -o StrictHostKeyChecking=no $Server $SshCmd
}

Write-Host "Updating backend..."
ssh -i $KeyPath -o StrictHostKeyChecking=no $Server "cd ${BasePath}/backend && sudo npx prisma db push && pm2 reload planaai-backend"

Write-Host "Building frontend..."
ssh -i $KeyPath -o StrictHostKeyChecking=no $Server "cd ${BasePath}/client && npm uninstall react-google-recaptcha @types/react-google-recaptcha && rm -rf .next && npm install && npm run build && pm2 reload planaai-frontend"

Write-Host "Deployment completed!"
