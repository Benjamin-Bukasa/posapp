param()

$printers = Get-CimInstance Win32_Printer |
  Sort-Object @{ Expression = { if ($_.Default) { 0 } else { 1 } } }, Name |
  ForEach-Object {
    [PSCustomObject]@{
      name = $_.Name
      driverName = $_.DriverName
      portName = $_.PortName
      shareName = $_.ShareName
      isDefault = [bool]$_.Default
      isShared = [bool]$_.Shared
      systemName = $_.SystemName
      status = $_.PrinterStatus
    }
  }

$printers | ConvertTo-Json -Compress
