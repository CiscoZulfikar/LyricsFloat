# test/mock-media-filter.ps1
function Wait-WinRT($task, $type) { return $null }

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
        # Music streaming web apps populate AlbumTitle (Spotify Web, Apple Music Web, YT Music, Deezer Web, Tidal Web)
        if ($s.AlbumTitle -and $s.AlbumTitle.Trim().Length -gt 0) {
            return $true
        }
        # Explicit block for browser tabs showing chat apps
        if ($s.WindowTitle -and ($s.WindowTitle -match 'WhatsApp|Telegram|Discord|Slack|Teams|Zoom|Skype|Meet')) {
            return $false
        }
        # Allow supported media web services
        if ($s.WindowTitle -and ($s.WindowTitle -match 'YouTube|Apple Music|SoundCloud|Tidal|Deezer|Amazon Music|Bandcamp|Spotify')) {
            return $true
        }
    }

    return $false
}

$cases = @(
    @{ App = '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App'; Expected = $false; Name = 'WhatsApp Desktop App' },
    @{ App = 'WhatsApp.exe'; Expected = $false; Name = 'WhatsApp Exe' },
    @{ App = 'Telegram.exe'; Expected = $false; Name = 'Telegram' },
    @{ App = 'Discord.exe'; Expected = $false; Name = 'Discord' },
    @{ App = 'slack.exe'; Expected = $false; Name = 'Slack' },
    @{ App = 'Skype.exe'; Expected = $false; Name = 'Skype' },
    @{ App = 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify'; Expected = $true; Name = 'Spotify Store' },
    @{ App = 'Spotify.exe'; Expected = $true; Name = 'Spotify Win32' },
    @{ App = 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!App'; Expected = $true; Name = 'Apple Music Store' },
    @{ App = 'AppleMusic.exe'; Expected = $true; Name = 'Apple Music Win32' },
    @{ App = 'iTunes.exe'; Expected = $true; Name = 'iTunes' },
    @{ App = 'com.github.th-ch.youtube-music'; Expected = $true; Name = 'YouTube Music Desktop' },
    @{ App = 'YouTube Music.exe'; Expected = $true; Name = 'YouTube Music Exe' },
    @{ App = 'YouTube.exe'; Expected = $true; Name = 'YouTube Desktop' },
    @{ App = 'Chrome._crx_cinhimbakebhgbejmpcfclkgapadafhn'; Expected = $true; Name = 'YouTube Music PWA' },
    @{ App = 'TIDAL.exe'; Expected = $true; Name = 'Tidal Desktop' },
    @{ App = 'AmazonMusic.exe'; Expected = $true; Name = 'Amazon Music Desktop' },
    @{ App = 'Deezer.exe'; Expected = $true; Name = 'Deezer Desktop' },
    @{ App = 'chrome.exe'; AlbumTitle = 'After Hours'; Expected = $true; Name = 'Chrome YTM with Album' },
    @{ App = 'chrome.exe'; WindowTitle = 'Song - Artist - YouTube Music'; Expected = $true; Name = 'Chrome YTM Window Title' },
    @{ App = 'chrome.exe'; WindowTitle = 'Music Video - YouTube'; Expected = $true; Name = 'Chrome Regular YouTube' },
    @{ App = 'chrome.exe'; WindowTitle = 'Artist - Track - SoundCloud'; Expected = $true; Name = 'Chrome SoundCloud' },
    @{ App = 'chrome.exe'; WindowTitle = '(1) WhatsApp'; Expected = $false; Name = 'Chrome WhatsApp Web' },
    @{ App = 'chrome.exe'; WindowTitle = 'Discord | #general'; Expected = $false; Name = 'Chrome Discord Web' }
)

$allPassed = $true
foreach ($c in $cases) {
    $mock = [PSCustomObject]@{
        SourceAppUserModelId = $c.App
        AlbumTitle = $c.AlbumTitle
        WindowTitle = $c.WindowTitle
    }
    $res = Test-IsAllowedSession $mock
    if ($res -ne $c.Expected) {
        Write-Host ('FAILED: ' + $c.Name + ' expected ' + $c.Expected + ' got ' + $res) -ForegroundColor Red
        $allPassed = $false
    } else {
        Write-Host ('PASSED: ' + $c.Name) -ForegroundColor Green
    }
}

if (-not $allPassed) {
    exit 1
}
exit 0
