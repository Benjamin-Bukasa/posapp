param(
  [Parameter(Mandatory = $true)]
  [string]$FilePath,
  [string]$PrinterName,
  [string]$JobName = "POSapp Ticket"
)

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "Fichier ticket introuvable."
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
  $defaultPrinter = Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1
  if (-not $defaultPrinter) {
    throw "Aucune imprimante par defaut n'est configuree sur ce poste."
  }
  $PrinterName = $defaultPrinter.Name
}

$printerExists = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $PrinterName } | Select-Object -First 1
if (-not $printerExists) {
  throw "Imprimante introuvable: $PrinterName"
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO di);

    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
if (-not $bytes -or $bytes.Length -eq 0) {
  throw "Le ticket est vide."
}

$printerHandle = [IntPtr]::Zero
$opened = [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$printerHandle, [IntPtr]::Zero)
if (-not $opened) {
  $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  throw "Impossible d'ouvrir l'imprimante $PrinterName. Code Win32: $code"
}

try {
  $docInfo = New-Object RawPrinterHelper+DOCINFO
  $docInfo.pDocName = $JobName
  $docInfo.pDataType = "RAW"

  $jobId = [RawPrinterHelper]::StartDocPrinter($printerHandle, 1, $docInfo)
  if ($jobId -eq 0) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "Impossible de demarrer le job d'impression. Code Win32: $code"
  }

  $pageStarted = [RawPrinterHelper]::StartPagePrinter($printerHandle)
  if (-not $pageStarted) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "Impossible de demarrer la page d'impression. Code Win32: $code"
  }

  $written = 0
  $success = [RawPrinterHelper]::WritePrinter($printerHandle, $bytes, $bytes.Length, [ref]$written)
  if (-not $success -or $written -ne $bytes.Length) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "Impossible d'envoyer le ticket complet a l'imprimante. Code Win32: $code"
  }

  [void][RawPrinterHelper]::EndPagePrinter($printerHandle)
  [void][RawPrinterHelper]::EndDocPrinter($printerHandle)

  [PSCustomObject]@{
    success = $true
    printerName = $PrinterName
    bytesWritten = $written
    jobName = $JobName
  } | ConvertTo-Json -Compress
}
finally {
  if ($printerHandle -ne [IntPtr]::Zero) {
    [void][RawPrinterHelper]::ClosePrinter($printerHandle)
  }
}
