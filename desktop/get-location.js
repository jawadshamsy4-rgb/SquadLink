const { exec } = require('child_process');

function getWindowsLocation() {
  return new Promise((resolve) => {
    const script = [
      'Add-Type -AssemblyName System.Device',
      '$w = New-Object System.Device.Location.GeoCoordinateWatcher',
      '$w.Start()',
      'Start-Sleep -Milliseconds 600',
      '$c = $w.Position.Location',
      'if(-not $c.IsUnknown){ Write-Output ($c.Latitude.ToString() + " " + $c.Longitude.ToString()) }'
    ].join('; ');

    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    exec(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 4000 }, (err, stdout) => {
      if (!err && stdout) {
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            return resolve({ lat, lng });
          }
        }
      }
      resolve(null);
    });
  });
}

module.exports = { getWindowsLocation };
