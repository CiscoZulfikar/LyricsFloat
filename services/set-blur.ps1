param (
    [Parameter(Mandatory=$true)]
    [long]$Hwnd,
    [int]$OpacityPercent = 90
)

$code = @'
using System;
using System.Runtime.InteropServices;

public class WinBlurHelper {
    [DllImport("dwmapi.dll")]
    public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    public static void EnableAcrylic(IntPtr hwnd, int alpha) {
        // 1. Force Windows 11 Native Rounded Corners (DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWCP_ROUND = 2)
        try {
            int cornerPreference = 2; // DWMWCP_ROUND (Standard smooth anti-aliased Windows 11 rounded corners)
            DwmSetWindowAttribute(hwnd, 33, ref cornerPreference, sizeof(int));
        } catch {}

        // 2. Windows 11 Native System Backdrop (DWMWA_SYSTEMBACKDROP_TYPE = 38: 4 = Acrylic, 3 = Mica)
        try {
            int backdropType = 4; // Acrylic
            DwmSetWindowAttribute(hwnd, 38, ref backdropType, sizeof(int));
        } catch {}
    }
}

'@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ErrorAction SilentlyContinue
} catch {}

try {
    $ptr = [IntPtr]$Hwnd
    $alpha = [int](($OpacityPercent / 100.0) * 255)
    [WinBlurHelper]::EnableAcrylic($ptr, $alpha)
    Write-Host "SUCCESS"
} catch {
    Write-Host "ERROR: $_"
}
