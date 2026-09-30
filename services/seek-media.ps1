# services/seek-media.ps1
param (
    [Parameter(Mandatory = $true)]
    [long]$PositionMs
)

$ErrorActionPreference = 'SilentlyContinue'

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    }[0]

    function Wait-WinRT($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(1200) | Out-Null
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
            $ticks = [long]($PositionMs * 10000)
            $op = $session.TryChangePlaybackPositionAsync($ticks)
            $res = Wait-WinRT $op ([bool])
            Write-Output $res
            exit 0
        }
    }
} catch {
    Write-Output "false"
    exit 1
}

Write-Output "false"
