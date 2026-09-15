$ErrorActionPreference = 'SilentlyContinue'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

function Await-WinRt($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(500) | Out-Null
    return $netTask.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Acquire manager ONCE to avoid WinRT RPC bottlenecks
$manager = Await-WinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

$lastTitle = ""
$lastArtist = ""
$lastPlaying = $false
$lastReportTime = 0

while ($true) {
    try {
        if (-not $manager) {
            $manager = Await-WinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
        }

        $session = $manager.GetCurrentSession()
        
        if ($session) {
            $media = Await-WinRt ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $timeline = $session.GetTimelineProperties()
            $info = $session.GetPlaybackInfo()

            if ($media -and $media.Title -and $media.Artist) {
                $isPlaying = ($info.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing)
                $pos = [int]$timeline.Position.TotalMilliseconds
                $dur = [int]$timeline.EndTime.TotalMilliseconds

                $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                $trackChanged = ($media.Title -ne $lastTitle -or $media.Artist -ne $lastArtist -or $isPlaying -ne $lastPlaying)

                # Report immediately on track/state change, or every 1000ms for smooth progress
                if ($trackChanged -or ($now - $lastReportTime -ge 1000)) {
                    $lastTitle = $media.Title
                    $lastArtist = $media.Artist
                    $lastPlaying = $isPlaying
                    $lastReportTime = $now

                    $result = @{
                        isPlaying = $isPlaying
                        artist = $media.Artist
                        title = $media.Title
                        album = $media.AlbumTitle
                        positionMs = $pos
                        durationMs = $dur
                        source = "windows_media"
                    }
                    Write-Output ($result | ConvertTo-Json -Compress)
                    [Console]::Out.Flush()
                }
            } else {
                if ($lastPlaying) {
                    $lastPlaying = $false
                    Write-Output '{"isPlaying":false}'
                    [Console]::Out.Flush()
                }
            }
        } else {
            if ($lastPlaying) {
                $lastPlaying = $false
                Write-Output '{"isPlaying":false}'
                [Console]::Out.Flush()
            }
        }
    } catch {
        # ignore transient COM errors
    }

    Start-Sleep -Milliseconds 200
}
