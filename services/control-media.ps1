# services/control-media.ps1
param (
    [Parameter(Mandatory = $true)]
    [ValidateSet("PlayPause", "Next", "Previous", "Play", "Pause")]
    [string]$Action
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
    $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = Wait-WinRT $asyncOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

    if ($mgr) {
        $session = $mgr.GetCurrentSession()
        if (-not $session) {
            $sessions = $mgr.GetSessions()
            foreach ($s in $sessions) {
                if ($s.SourceAppUserModelId -match 'Spotify' -or $s.SourceAppUserModelId -match 'Music') {
                    $session = $s
                    break
                }
            }
        }

        if ($session) {
            $op = $null
            switch ($Action) {
                'PlayPause' { $op = $session.TryTogglePlayPauseAsync() }
                'Next'      { $op = $session.TrySkipNextAsync() }
                'Previous'  { $op = $session.TrySkipPreviousAsync() }
                'Play'      { $op = $session.TryPlayAsync() }
                'Pause'     { $op = $session.TryPauseAsync() }
            }

            if ($op) {
                $res = Wait-WinRT $op ([bool])
                Write-Output $res
                exit 0
            }
        }
    }
} catch {
    Write-Output "false"
    exit 1
}

Write-Output "false"
