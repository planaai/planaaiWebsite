$KeyPath = "ssh-key-2026-07-01.key"
$Server = "ubuntu@140.245.70.15"
$BasePath = "/var/www/planaaiWebsite"

# Array of files to deploy
$Files = @(
    "backend\prisma\schema.prisma",
    "backend\routes\auth.js",
    "backend\routes\raids.js",
    "backend\utils\recaptcha.js",
    "client\src\app\register\page.tsx",
    "client\src\components\raid\RaidPartyCard.tsx",
    "client\src\types\raid.ts",
    "client\src\lib\api.ts",
    "client\src\lib\fingerprint.ts",
    "client\package.json",
    "client\package-lock.json"
)

foreach ($File in $Files) {
    # Replace backslashes with forward slashes for Linux path
    $LinuxPath = $File -replace '\\', '/'
    $Target = "${Server}:${BasePath}/${LinuxPath}"
    
    Write-Host "Deploying $File to $Target..."
    
    # We use StrictHostKeyChecking=no to avoid prompts
    # Since backend folder might be owned by root on the server, we can scp to /tmp first, then sudo mv
    
    # Actually, let's scp to a temp directory on the server first to avoid permission issues
    $TempTarget = "${Server}:/tmp/deploy_$($File.Split('\')[-1])"
    scp -i $KeyPath -o StrictHostKeyChecking=no $File $TempTarget
    
    # Then use ssh to sudo mv the file into place
    $SshCmd = "sudo mv /tmp/deploy_$($File.Split('\')[-1]) ${BasePath}/${LinuxPath} && sudo chown -R ubuntu:ubuntu ${BasePath}/${LinuxPath}"
    ssh -i $KeyPath -o StrictHostKeyChecking=no $Server $SshCmd
}

Write-Host "All files deployed successfully."
