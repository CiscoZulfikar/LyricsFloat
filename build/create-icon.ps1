Add-Type -AssemblyName System.Drawing

function New-AppIcon {
    param(
        [string]$PngPath = "build/icon.png",
        [string]$IcoPath = "build/icon.ico"
    )

    $sizes = @(256, 128, 64, 48, 32, 16)
    $bitmaps = @()

    foreach ($size in $sizes) {
        $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)

        [float]$scale = [float]$size / 256.0

        # 1. Background Rounded Squircle
        [float]$x = 10.0 * $scale
        [float]$y = 10.0 * $scale
        [float]$w = 236.0 * $scale
        [float]$h = 236.0 * $scale
        [float]$radius = 52.0 * $scale

        $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $path.AddArc($x, $y, $radius * 2, $radius * 2, 180, 90)
        $path.AddArc($x + $w - ($radius * 2), $y, $radius * 2, $radius * 2, 270, 90)
        $path.AddArc($x + $w - ($radius * 2), $y + $h - ($radius * 2), $radius * 2, $radius * 2, 0, 90)
        $path.AddArc($x, $y + $h - ($radius * 2), $radius * 2, $radius * 2, 90, 90)
        $path.CloseFigure()

        # Deep Midnight Obsidian to Slate Navy Background Fill
        $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            [System.Drawing.PointF]::new(0, 0),
            [System.Drawing.PointF]::new($size, $size),
            [System.Drawing.Color]::FromArgb(255, 15, 23, 42),
            [System.Drawing.Color]::FromArgb(255, 4, 7, 14)
        )
        $g.FillPath($bgBrush, $path)

        # Luminous Cyber Neon Border (Electric Cyan to Neon Violet)
        $borderBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            [System.Drawing.PointF]::new(0, 0),
            [System.Drawing.PointF]::new($size, $size),
            [System.Drawing.Color]::FromArgb(250, 56, 189, 248),  # #38bdf8
            [System.Drawing.Color]::FromArgb(250, 168, 85, 247)   # #a855f7
        )
        $borderPen = [System.Drawing.Pen]::new($borderBrush, [Math]::Max(1.0, 6.0 * $scale))
        $g.DrawPath($borderPen, $path)

        # Helper to draw rounded pill capsules (stripes)
        $drawPill = {
            param($targetG, $brush, [float]$px, [float]$py, [float]$pw, [float]$ph)
            $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $p.AddArc($px, $py, $ph, $ph, 90, 180)
            $p.AddArc($px + $pw - $ph, $py, $ph, $ph, 270, 180)
            $p.CloseFigure()
            $targetG.FillPath($brush, $p)
            $p.Dispose()
        }

        # 2. Minimalist Music Note (Left Side)
        $noteBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            [System.Drawing.PointF]::new(50 * $scale, 70 * $scale),
            [System.Drawing.PointF]::new(115 * $scale, 190 * $scale),
            [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
            [System.Drawing.Color]::FromArgb(255, 125, 211, 252) # #7dd3fc
        )

        # Note Head (Tilted ellipse)
        $state = $g.Save()
        $g.TranslateTransform(78.0 * $scale, 166.0 * $scale)
        $g.RotateTransform(-22)
        $g.FillEllipse($noteBrush, [float](-24.0 * $scale), [float](-18.0 * $scale), [float](48.0 * $scale), [float](36.0 * $scale))
        $g.Restore($state)

        # Note Stem
        $stemPen = [System.Drawing.Pen]::new($noteBrush, [Math]::Max(1.2, 11.0 * $scale))
        $stemPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $stemPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawLine($stemPen, [float](97.0 * $scale), [float](162.0 * $scale), [float](97.0 * $scale), [float](72.0 * $scale))

        # Note Flag (Curved wave)
        $flagPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $flagPath.AddBezier(
            [float](97.0 * $scale), [float](72.0 * $scale),
            [float](124.0 * $scale), [float](76.0 * $scale),
            [float](134.0 * $scale), [float](108.0 * $scale),
            [float](114.0 * $scale), [float](124.0 * $scale)
        )
        $flagPen = [System.Drawing.Pen]::new($noteBrush, [Math]::Max(1.0, 9.5 * $scale))
        $flagPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawPath($flagPen, $flagPath)

        # 3. Horizontal Stripes as Simplified Lyrics (Right Side)
        # Stripe 1: Upper verse (Frosted white/slate)
        $stripe1 = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 226, 232, 240))
        & $drawPill $g $stripe1 (134.0 * $scale) (82.0 * $scale) (72.0 * $scale) ([Math]::Max(2.0, 12.0 * $scale))

        # Stripe 2: Active singing lyric (Prominent, radiant electric cyan to neon violet glow!)
        $stripe2 = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            [System.Drawing.PointF]::new(134.0 * $scale, 108.0 * $scale),
            [System.Drawing.PointF]::new(228.0 * $scale, 123.0 * $scale),
            [System.Drawing.Color]::FromArgb(255, 56, 189, 248),  # #38bdf8
            [System.Drawing.Color]::FromArgb(255, 192, 132, 252)  # #c084fc
        )
        & $drawPill $g $stripe2 (134.0 * $scale) (108.0 * $scale) (92.0 * $scale) ([Math]::Max(2.5, 15.0 * $scale))

        # Stripe 3: Translation / Romaji sub-text (Soft sky blue)
        $stripe3 = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(210, 147, 197, 253))
        & $drawPill $g $stripe3 (134.0 * $scale) (135.0 * $scale) (60.0 * $scale) ([Math]::Max(1.5, 9.0 * $scale))

        # Stripe 4: Next verse (Subtle muted slate)
        $stripe4 = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(150, 148, 163, 184))
        & $drawPill $g $stripe4 (134.0 * $scale) (154.0 * $scale) (78.0 * $scale) ([Math]::Max(2.0, 12.0 * $scale))

        $g.Dispose()
        $bitmaps += $bmp
    }

    # Save 256x256 PNG
    $bitmaps[0].Save($PngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Successfully saved PNG to $PngPath"

    # Save multi-res Windows .ico file
    $fs = [System.IO.File]::OpenWrite($IcoPath)
    $bw = [System.IO.BinaryWriter]::new($fs)

    # ICONDIR header (6 bytes)
    $bw.Write([UInt16]0) # Reserved
    $bw.Write([UInt16]1) # Type 1 = ICO
    $bw.Write([UInt16]$sizes.Count) # Count of images

    $offset = 6 + (16 * $sizes.Count)
    $pngStreams = @()

    foreach ($bmp in $bitmaps) {
        $ms = [System.IO.MemoryStream]::new()
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bytes = $ms.ToArray()
        $pngStreams += ,$bytes

        $w = if ($bmp.Width -ge 256) { 0 } else { [byte]$bmp.Width }
        $h = if ($bmp.Height -ge 256) { 0 } else { [byte]$bmp.Height }

        $bw.Write([byte]$w)
        $bw.Write([byte]$h)
        $bw.Write([byte]0)   # Color count
        $bw.Write([byte]0)   # Reserved
        $bw.Write([UInt16]1) # Color planes
        $bw.Write([UInt16]32) # Bits per pixel
        $bw.Write([UInt32]$bytes.Length) # Image size in bytes
        $bw.Write([UInt32]$offset)       # Image offset

        $offset += $bytes.Length
    }

    foreach ($bytes in $pngStreams) {
        $bw.Write($bytes)
    }

    $bw.Flush()
    $fs.Close()
    Write-Output "Successfully saved multi-resolution ICO to $IcoPath"

    foreach ($bmp in $bitmaps) {
        $bmp.Dispose()
    }
}

New-AppIcon
