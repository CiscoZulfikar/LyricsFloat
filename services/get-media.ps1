# services/get-media.ps1
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8


# 1. Try Windows GSMTC (Windows Media Session)
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    }[0]

    function Wait-WinRT($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(1500) | Out-Null
        return $netTask.Result
    }

    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null

    function Test-IsAllowedSession($s) {
        if (-not $s) { return $false }
        $appId = $s.SourceAppUserModelId
        if (-not $appId) { return $false }

        # Explicit blocklist: WhatsApp, Telegram, Discord, Zoom, Teams, Slack, Skype, etc.
        if ($appId -match 'WhatsApp|Telegram|Discord|Zoom|Teams|Slack|Skype') {
            return $false
        }

        # 1. Spotify (Windows Store or Desktop exe)
        if ($appId -match 'Spotify') {
            return $true
        }

        # 2. Apple Music & iTunes (Windows Store app, Desktop preview, or iTunes)
        if ($appId -match 'AppleMusic|Apple\.Music|iTunes') {
            return $true
        }

        # 3. YouTube & YouTube Music Desktop / PWA
        if ($appId -match 'YouTube[\s\-_]*Music|youtubemusic|cinhimbakebhgbejmpcfclkgapadafhn|agimnkijcaahngcdmfeangaknmldooml|YouTube') {
            return $true
        }

        # 4. Tidal, Amazon Music, Deezer, SoundCloud, Bandcamp, Local players
        if ($appId -match 'TIDAL|Amazon[\s\-_]*Music|AmazonMusic|Deezer|SoundCloud|Bandcamp|foobar2000|MusicBee|AIMP') {
            return $true
        }

        # 5. Web Browsers (Chrome, Edge, Firefox, Brave, Vivaldi, Opera)
        if ($appId -match 'chrome|msedge|firefox|brave|vivaldi|opera') {
            try {
                $pOp = $s.TryGetMediaPropertiesAsync()
                $p = Wait-WinRT $pOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                if ($p) {
                    # Music streaming web apps (Spotify Web, Apple Music Web, YT Music, Deezer Web, Tidal Web, SoundCloud) populate AlbumTitle
                    if ($p.AlbumTitle -and $p.AlbumTitle.Trim().Length -gt 0) {
                        return $true
                    }
                    # Check browser window titles for supported services
                    $procName = if ($appId -match 'msedge') { 'msedge' } elseif ($appId -match 'firefox') { 'firefox' } elseif ($appId -match 'brave') { 'brave' } else { 'chrome' }
                    $windows = Get-Process -Name $procName -ErrorAction SilentlyContinue
                    if ($windows) {
                        $chatWindow = $windows | Where-Object { $_.MainWindowTitle -match 'WhatsApp|Telegram|Discord|Slack|Teams|Zoom|Skype|Meet' }
                        if ($chatWindow -and (-not ($windows | Where-Object { $_.MainWindowTitle -match 'YouTube|Apple Music|SoundCloud|Tidal|Deezer|Amazon Music|Bandcamp|Spotify' }))) {
                            return $false
                        }
                        $mediaWindow = $windows | Where-Object { $_.MainWindowTitle -match 'YouTube|Apple Music|SoundCloud|Tidal|Deezer|Amazon Music|Bandcamp|Spotify' }
                        if ($mediaWindow) {
                            return $true
                        }
                    }
                }
            } catch {}
        }

        return $false
    }

    function Get-TargetSession($mgr) {
        if (-not $mgr) { return $null }
        $sessions = $mgr.GetSessions()
        if (-not $sessions -or $sessions.Count -eq 0) { return $null }

        $allowedSessions = @()
        foreach ($s in $sessions) {
            if (Test-IsAllowedSession $s) {
                $allowedSessions += $s
            }
        }

        if ($allowedSessions.Count -eq 0) { return $null }
        if ($allowedSessions.Count -eq 1) { return $allowedSessions[0] }

        $current = $mgr.GetCurrentSession()
        if ($current) {
            $currId = $current.SourceAppUserModelId
            foreach ($s in $allowedSessions) {
                if ($s.SourceAppUserModelId -eq $currId) {
                    $info = $s.GetPlaybackInfo()
                    $isPlaying = ($info -and ($info.PlaybackStatus -eq 4 -or $info.PlaybackStatus -eq 'Playing' -or "$($info.PlaybackStatus)" -eq 'Playing'))
                    if ($isPlaying) { return $s }
                }
            }
        }

        foreach ($s in $allowedSessions) {
            $info = $s.GetPlaybackInfo()
            if ($info -and ($info.PlaybackStatus -eq 4 -or $info.PlaybackStatus -eq 'Playing' -or "$($info.PlaybackStatus)" -eq 'Playing')) {
                return $s
            }
        }

        if ($current) {
            $currId = $current.SourceAppUserModelId
            foreach ($s in $allowedSessions) {
                if ($s.SourceAppUserModelId -eq $currId) {
                    return $s
                }
            }
        }

        return $allowedSessions[0]
    }

    $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = Wait-WinRT $asyncOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    
    if ($mgr) {
        $session = Get-TargetSession $mgr

        if ($session) {
            $propOp = $session.TryGetMediaPropertiesAsync()
            $props = Wait-WinRT $propOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $timeline = $session.GetTimelineProperties()
            $info = $session.GetPlaybackInfo()

            if ($props -and $props.Title) {
                $isPlaying = ($info.PlaybackStatus -eq 4 -or $info.PlaybackStatus -eq 'Playing' -or "$($info.PlaybackStatus)" -eq 'Playing')
                $pos = 0
                if ($timeline.Position) {
                    $pos = $timeline.Position.TotalMilliseconds
                    if ($isPlaying -and $timeline.LastUpdatedTime) {
                        $elapsedSinceUpdate = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalMilliseconds
                        if ($elapsedSinceUpdate -gt 0 -and $elapsedSinceUpdate -lt 86400000) {
                            $pos += $elapsedSinceUpdate
                        }
                    }
                }
                [PSCustomObject]@{
                    Title = $props.Title
                    Artist = $props.Artist
                    Album = $props.AlbumTitle
                    TrackNumber = if ($props.TrackNumber) { [int]$props.TrackNumber } else { 0 }
                    IsPlaying = $isPlaying
                    PositionMs = [Math]::Round($pos)
                    DurationMs = if ($timeline.EndTime) { [Math]::Round($timeline.EndTime.TotalMilliseconds) } else { 0 }
                    Source = 'GSMTC'
                } | ConvertTo-Json -Compress
                exit 0
            }

        }
    }
} catch {
    # Fallback to Window Title
}

# 2. Fallback: Spotify Window Title Inspection
try {
    $processes = Get-Process -Name "spotify" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -ne "Spotify" -and $_.MainWindowTitle -ne "Spotify Free" -and $_.MainWindowTitle -ne "Spotify Premium" }
    
    if ($processes) {
        $title = $processes[0].MainWindowTitle
        # Format is usually: "Artist - Title" or "Artist – Title"
        $parts = $title -split ' - | – '
        if ($parts.Count -ge 2) {
            $artist = $parts[0].Trim()
            $songTitle = ($parts[1..($parts.Count - 1)] -join ' - ').Trim()
            [PSCustomObject]@{
                Title = $songTitle
                Artist = $artist
                Album = ''
                TrackNumber = 0
                IsPlaying = $true
                PositionMs = 0
                DurationMs = 0
                Source = 'WindowTitle'
            } | ConvertTo-Json -Compress
            exit 0
        }
    }
} catch {}

# 3. Fallback: Win32 EnumWindows across all Spotify processes
try {
    $code = @"
    using System;
    using System.Collections.Generic;
    using System.Runtime.InteropServices;
    using System.Text;

    public class WindowHelper {
        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        public static List<string> GetSpotifyTitles(List<uint> pids) {
            List<string> titles = new List<string>();
            EnumWindows((hWnd, lParam) => {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (pids.Contains(pid)) {
                    StringBuilder sb = new StringBuilder(512);
                    GetWindowText(hWnd, sb, 512);
                    string text = sb.ToString();
                    if (!string.IsNullOrWhiteSpace(text) && text != "Spotify" && text != "Spotify Free" && text != "Spotify Premium" && text != "MSCTFIME UI" && text != "Default IME" && text.Contains(" - ")) {
                        titles.Add(text);
                    }
                }
                return true;
            }, IntPtr.Zero);
            return titles;
        }
    }
"@
    Add-Type -TypeDefinition $code
    $pids = [System.Collections.Generic.List[uint]](Get-Process spotify -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    if ($pids.Count -gt 0) {
        $titles = [WindowHelper]::GetSpotifyTitles($pids)
        if ($titles.Count -gt 0) {
            $raw = $titles[0]
            $parts = $raw -split ' - | – '
            if ($parts.Count -ge 2) {
                $artist = $parts[0].Trim()
                $songTitle = ($parts[1..($parts.Count - 1)] -join ' - ').Trim()
                [PSCustomObject]@{
                    Title = $songTitle
                    Artist = $artist
                    Album = ''
                    TrackNumber = 0
                    IsPlaying = $true
                    PositionMs = 0
                    DurationMs = 0
                    Source = 'Win32EnumWindows'
                } | ConvertTo-Json -Compress
                exit 0
            }
        }
    }
} catch {}

Write-Output "{}"
