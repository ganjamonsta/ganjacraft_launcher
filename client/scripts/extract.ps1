
Add-Type -AssemblyName System.IO.Compression.FileSystem

$jarFiles = @(
    'S:\\Games\\GanjaCraft Launcher\\game\\libraries\\net\\minecraft\\client\\1.21.1-20240808.144430\\client-1.21.1-20240808.144430-extra.jar',
    'S:\\Games\\GanjaCraft Launcher\\game\\libraries\\net\\minecraft\\client\\1.21.1-20240808.144430\\client-1.21.1-20240808.144430-slim.jar'
)

$outArmor = 'D:\\GanjaCraft\\git\\ganja_launcher\\client\\src\\assets\\equipment\\armor'
$outItems = 'D:\\GanjaCraft\\git\\ganja_launcher\\client\\src\\assets\\equipment\\items'

foreach ($jarPath in $jarFiles) {
    if (Test-Path $jarPath) {
        Write-Host "Opening jar: $jarPath"
        $zip = [System.IO.Compression.ZipFile]::OpenRead($jarPath)
        foreach ($entry in $zip.Entries) {
            # Armor textures: assets/minecraft/textures/models/armor/*.png or entity/equipment/...
            if ($entry.FullName -match 'textures/models/armor/.*\.png$' -or $entry.FullName -match 'textures/entity/equipment/.*\.png$') {
                $destFile = Join-Path $outArmor $entry.Name
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destFile, $true)
                Write-Host "Extracted Armor: $($entry.Name)"
            }
            # Vanilla items
            if ($entry.FullName -match 'textures/item/(diamond_|netherite_|iron_|golden_|chainmail_|leather_|shield|totem).*\.png$') {
                $destFile = Join-Path $outItems $entry.Name
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destFile, $true)
                Write-Host "Extracted Item: $($entry.Name)"
            }
        }
        $zip.Dispose()
    }
}
