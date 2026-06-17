param (
    [string]$PdfPath,
    [string[]]$Keywords = @("torque", "nm", "apriete", "tornillo", "n.m", "m2", "m1.6", "m2.5", "tighten", "screwdriver")
)

Write-Output "Searching inside: $PdfPath"
if (-not (Test-Path $PdfPath)) {
    Write-Output "File not found!"
    return
}

$fileBytes = [System.IO.File]::ReadAllBytes($PdfPath)
$streamStartAnchor = [System.Text.Encoding]::ASCII.GetBytes("stream")
$streamEndAnchor = [System.Text.Encoding]::ASCII.GetBytes("endstream")

# Helper function to find byte patterns
function Find-Pattern ($bytes, $pattern, $startIndex) {
    for ($i = $startIndex; $i -le ($bytes.Length - $pattern.Length); $i++) {
        $match = $true
        for ($j = 0; $j -lt $pattern.Length; $j++) {
            if ($bytes[$i + $j] -ne $pattern[$j]) {
                $match = $false
                break
            }
        }
        if ($match) { return $i }
    }
    return -1
}

# Decompress a zlib compressed byte array
function Decompress-Zlib ($bytes) {
    if ($bytes.Length -le 2) { return $null }
    # Skip the 2-byte zlib header (usually 0x78 0x9c or 0x78 0xda)
    $ms = New-Object System.IO.MemoryStream
    $ms.Write($bytes, 2, $bytes.Length - 2)
    $ms.Position = 0
    
    $ds = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
    $decompressedMs = New-Object System.IO.MemoryStream
    try {
        $ds.CopyTo($decompressedMs)
        return $decompressedMs.ToArray()
    } catch {
        return $null # Failed to decompress (might not be zlib or corrupted)
    } finally {
        $ds.Close()
        $ms.Close()
        $decompressedMs.Close()
    }
}

$index = 0
$streamCount = 0
$matchCount = 0

while ($index -lt $fileBytes.Length) {
    # Find next stream
    $start = Find-Pattern $fileBytes $streamStartAnchor $index
    if ($start -eq -1) { break }
    
    # Check if we have newline after 'stream' (PDF specs: stream is followed by CRLF or LF)
    $dataStart = $start + 6
    if ($fileBytes[$dataStart] -eq 13 -and $fileBytes[$dataStart+1] -eq 10) {
        $dataStart += 2
    } elseif ($fileBytes[$dataStart] -eq 10) {
        $dataStart += 1
    }
    
    $end = Find-Pattern $fileBytes $streamEndAnchor $dataStart
    if ($end -eq -1) { break }
    
    # Check if there is a CR or LF before 'endstream'
    $dataEnd = $end
    if ($fileBytes[$dataEnd - 1] -eq 10) {
        $dataEnd -= 1
        if ($fileBytes[$dataEnd - 1] -eq 13) {
            $dataEnd -= 1
        }
    }
    
    $streamLen = $dataEnd - $dataStart
    if ($streamLen -gt 0) {
        $streamBytes = New-Object byte[] $streamLen
        [System.Array]::Copy($fileBytes, $dataStart, $streamBytes, 0, $streamLen)
        
        $streamCount++
        
        # Try decompressing
        $decompressed = Decompress-Zlib $streamBytes
        $text = ""
        if ($decompressed) {
            $text = [System.Text.Encoding]::UTF8.GetString($decompressed)
        } else {
            # Try reading as plain ASCII if decompression fails
            $text = [System.Text.Encoding]::ASCII.GetString($streamBytes)
        }
        
        # Search for keywords
        foreach ($kw in $Keywords) {
            $pos = $text.IndexOf($kw, [System.StringComparison]::OrdinalIgnoreCase)
            if ($pos -ne -1) {
                $matchCount++
                $startPos = [Math]::Max(0, $pos - 100)
                $len = [Math]::Min($text.Length - $startPos, 250)
                $snippet = $text.Substring($startPos, $len)
                $snippetClean = $snippet -replace '\s+', ' '
                Write-Output "[Match $matchCount in Stream $streamCount (Keyword: '$kw')]:"
                Write-Output "  ... $snippetClean ..."
                Write-Output ""
            }
        }
    }
    
    $index = $end + 9
}

Write-Output "Finished search. Total streams checked: $streamCount. Total matches found: $matchCount."
