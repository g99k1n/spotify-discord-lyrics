$ErrorActionPreference = 'SilentlyContinue'

# 1. Try Spotify Process Window Title first
$spotifyProc = Get-Process -Name spotify | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -ne 'Spotify' -and $_.MainWindowTitle -ne 'Spotify Free' -and $_.MainWindowTitle -ne 'Spotify Premium' } | Select-Object -First 1

if ($spotifyProc) {
    $rawTitle = $spotifyProc.MainWindowTitle
    # Formats typically: "Artist - Title" or "Spotify - Artist - Title"
    $clean = $rawTitle -replace '^Spotify\s*-\s*', ''
    $parts = $clean -split '\s*-\s*', 2
    if ($parts.Length -ge 2) {
        $result = @{
            source = 'process_window'
            artist = $parts[0].Trim()
            title = $parts[1].Trim()
            isPlaying = $true
        }
        $result | ConvertTo-Json -Compress
        exit 0
    }
}

# 2. Try Windows.Media.Control WinRT API
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    
    function Await-WinRt($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        return $netTask.Result
    }

    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
    $manager = Await-WinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $session = $manager.GetCurrentSession()
    
    if ($session) {
        $media = Await-WinRt ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $timeline = $session.GetTimelineProperties()
        $info = $session.GetPlaybackInfo()
        
        $isPlaying = ($info.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing)
        
        $result = @{
            source = 'windows_media'
            artist = $media.Artist
            title = $media.Title
            album = $media.AlbumTitle
            isPlaying = $isPlaying
            positionMs = [int]$timeline.Position.TotalMilliseconds
            durationMs = [int]$timeline.EndTime.TotalMilliseconds
        }
        $result | ConvertTo-Json -Compress
        exit 0
    }
} catch {
    # WinRT not available
}

Write-Output '{"isPlaying":false}'
