Add-Type -AssemblyName System.Drawing

$destDir = "frontend/public/icons"
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

function Generate-Icon {
    param(
        [int]$Size,
        [string]$OutFile,
        [bool]$IsMaskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background Colors
    $navy = [System.Drawing.ColorTranslator]::FromHtml('#0B1729')
    $navyDark = [System.Drawing.ColorTranslator]::FromHtml('#060E1A')
    $orange1 = [System.Drawing.ColorTranslator]::FromHtml('#FF8A3D')
    $orange2 = [System.Drawing.ColorTranslator]::FromHtml('#F59E0B')

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $Size, $Size), $navy, $navyDark
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)

    $scale = $Size / 512.0
    if ($IsMaskable) {
        $badgeSize = [int](310 * $scale)
    } else {
        $badgeSize = [int](360 * $scale)
    }
    $badgeX = [int](($Size - $badgeSize) / 2)
    $badgeY = [int](($Size - $badgeSize) / 2)
    $cornerRad = [int](75 * $scale)

    # Draw rounded rectangle badge
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($badgeX, $badgeY, $cornerRad*2, $cornerRad*2, 180, 90)
    $path.AddArc($badgeX + $badgeSize - $cornerRad*2, $badgeY, $cornerRad*2, $cornerRad*2, 270, 90)
    $path.AddArc($badgeX + $badgeSize - $cornerRad*2, $badgeY + $badgeSize - $cornerRad*2, $cornerRad*2, $cornerRad*2, 0, 90)
    $path.AddArc($badgeX, $badgeY + $badgeSize - $cornerRad*2, $cornerRad*2, $cornerRad*2, 90, 90)
    $path.CloseFigure()

    $badgeBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point $badgeX, $badgeY), (New-Object System.Drawing.Point ($badgeX + $badgeSize), ($badgeY + $badgeSize)), $orange1, $orange2
    $g.FillPath($badgeBrush, $path)

    # Subtle inner border accent
    $penGlow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 255, 255, 255)), ([Math]::Max(1.0, 3.0 * $scale))
    $g.DrawPath($penGlow, $path)

    # Transform for angled wrench (-45 degrees)
    $g.TranslateTransform(($Size / 2), ($Size / 2))
    $g.RotateTransform(-45)

    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

    # Wrench Shaft
    $shaftW = [int](32 * $scale)
    $shaftH = [int](140 * $scale)
    $shaftX = [int](-$shaftW / 2)
    $shaftY = [int](-50 * $scale)
    $shaftRad = [int]($shaftW / 2)
    $shaftPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shaftPath.AddArc($shaftX, $shaftY, $shaftRad*2, $shaftRad*2, 180, 90)
    $shaftPath.AddArc($shaftX + $shaftW - $shaftRad*2, $shaftY, $shaftRad*2, $shaftRad*2, 270, 90)
    $shaftPath.AddArc($shaftX + $shaftW - $shaftRad*2, $shaftY + $shaftH - $shaftRad*2, $shaftRad*2, $shaftRad*2, 0, 90)
    $shaftPath.AddArc($shaftX, $shaftY + $shaftH - $shaftRad*2, $shaftRad*2, $shaftRad*2, 90, 90)
    $shaftPath.CloseFigure()
    $g.FillPath($whiteBrush, $shaftPath)

    # Wrench Top Jaw Head (Open end)
    $headR = [int](54 * $scale)
    $headY = [int](-75 * $scale)
    $g.FillEllipse($whiteBrush, -$headR, $headY - $headR, $headR*2, $headR*2)

    # Cutout for open jaw
    $jawW = [int](36 * $scale)
    $jawH = [int](52 * $scale)
    $g.FillRectangle($badgeBrush, [int](-$jawW/2), [int]($headY - $headR - 5), $jawW, $jawH)
    $jawBottomR = [int]($jawW / 2)
    $g.FillEllipse($badgeBrush, [int](-$jawW/2), [int]($headY - $headR - 5 + $jawH - $jawBottomR*2), $jawBottomR*2, $jawBottomR*2)

    # Wrench Bottom Ring (Closed box end)
    $ringR = [int](40 * $scale)
    $ringY = [int](92 * $scale)
    $g.FillEllipse($whiteBrush, -$ringR, $ringY - $ringR, $ringR*2, $ringR*2)
    $innerRingR = [int](20 * $scale)
    $g.FillEllipse($badgeBrush, -$innerRingR, $ringY - $innerRingR, $innerRingR*2, $innerRingR*2)

    $g.Dispose()
    $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: $OutFile"
}

Generate-Icon -Size 512 -OutFile "frontend/public/icons/icon-512x512.png"
Generate-Icon -Size 192 -OutFile "frontend/public/icons/icon-192x192.png"
Generate-Icon -Size 512 -OutFile "frontend/public/icons/icon-maskable-512x512.png" -IsMaskable $true
Generate-Icon -Size 180 -OutFile "frontend/public/icons/apple-touch-icon.png"
Generate-Icon -Size 48 -OutFile "frontend/public/favicon.png"
Copy-Item "frontend/public/favicon.png" "frontend/public/favicon.ico" -Force
Write-Host "All icons generated successfully!"
