[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$resolvedPath = [IO.Path]::GetFullPath($OutputPath)
$directory = Split-Path -Parent $resolvedPath
New-Item -ItemType Directory -Force -Path $directory | Out-Null

$bitmap = New-Object Drawing.Bitmap 256, 256
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.Color]::FromArgb(17, 28, 42))

$shield = New-Object Drawing.Drawing2D.GraphicsPath
$shield.AddPolygon([Drawing.Point[]]@(
  [Drawing.Point]::new(128, 30),
  [Drawing.Point]::new(202, 58),
  [Drawing.Point]::new(196, 144),
  [Drawing.Point]::new(169, 195),
  [Drawing.Point]::new(128, 225),
  [Drawing.Point]::new(87, 195),
  [Drawing.Point]::new(60, 144),
  [Drawing.Point]::new(54, 58)
))
$shieldPen = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(223, 253, 240)), 16
$shieldPen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawPath($shieldPen, $shield)

$checkPen = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(52, 211, 153)), 18
$checkPen.StartCap = [Drawing.Drawing2D.LineCap]::Round
$checkPen.EndCap = [Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLines($checkPen, [Drawing.Point[]]@(
  [Drawing.Point]::new(88, 128),
  [Drawing.Point]::new(119, 158),
  [Drawing.Point]::new(172, 98)
))

$icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [IO.File]::Open($resolvedPath, [IO.FileMode]::Create)
try {
  $icon.Save($stream)
} finally {
  $stream.Dispose()
  $icon.Dispose()
  $checkPen.Dispose()
  $shieldPen.Dispose()
  $shield.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
