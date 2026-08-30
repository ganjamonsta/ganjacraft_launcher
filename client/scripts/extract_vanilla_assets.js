const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const jarExtra = 'S:\\Games\\GanjaCraft Launcher\\game\\libraries\\net\\minecraft\\client\\1.21.1-20240808.144430\\client-1.21.1-20240808.144430-extra.jar';
const jarSlim = 'S:\\Games\\GanjaCraft Launcher\\game\\libraries\\net\\minecraft\\client\\1.21.1-20240808.144430\\client-1.21.1-20240808.144430-slim.jar';

const dstArmor = path.join(__dirname, '..', 'src', 'assets', 'equipment', 'armor');
const dstItems = path.join(__dirname, '..', 'src', 'assets', 'equipment', 'items');

if (!fs.existsSync(dstArmor)) fs.mkdirSync(dstArmor, { recursive: true });
if (!fs.existsSync(dstItems)) fs.mkdirSync(dstItems, { recursive: true });

// PowerShell script to extract matching armor and item files
const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem

$jarFiles = @(
    '${jarExtra.replace(/\\/g, '\\\\')}',
    '${jarSlim.replace(/\\/g, '\\\\')}'
)

$outArmor = '${dstArmor.replace(/\\/g, '\\\\')}'
$outItems = '${dstItems.replace(/\\/g, '\\\\')}'

foreach ($jarPath in $jarFiles) {
    if (Test-Path $jarPath) {
        Write-Host "Opening jar: $jarPath"
        $zip = [System.IO.Compression.ZipFile]::OpenRead($jarPath)
        foreach ($entry in $zip.Entries) {
            # Armor textures: assets/minecraft/textures/models/armor/*.png or entity/equipment/...
            if ($entry.FullName -match 'textures/models/armor/.*\\.png$' -or $entry.FullName -match 'textures/entity/equipment/.*\\.png$') {
                $destFile = Join-Path $outArmor $entry.Name
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destFile, $true)
                Write-Host "Extracted Armor: $($entry.Name)"
            }
            # Vanilla items
            if ($entry.FullName -match 'textures/item/(diamond_|netherite_|iron_|golden_|chainmail_|leather_|shield|totem).*\\.png$') {
                $destFile = Join-Path $outItems $entry.Name
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destFile, $true)
                Write-Host "Extracted Item: $($entry.Name)"
            }
        }
        $zip.Dispose()
    }
}
`;

fs.writeFileSync(path.join(__dirname, 'extract.ps1'), psScript);
console.log('Running extraction PowerShell script...');
try {
    const out = execSync('powershell -ExecutionPolicy Bypass -File "' + path.join(__dirname, 'extract.ps1') + '"');
    console.log(out.toString());
} catch (e) {
    console.error('Error extracting:', e);
}
