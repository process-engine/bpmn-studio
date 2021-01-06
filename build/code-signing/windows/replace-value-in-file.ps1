Param(
  [Parameter(Mandatory=$True, ValueFromPipeline=$True)]
  [String]
  $FilePath,

  [Parameter(Mandatory=$True)]
  [String]
  $OldValue,

  [Parameter(Mandatory=$True)]
  [String]
  $NewValue
)

$ResolvedFilePath = (Resolve-Path -Path $FilePath)[0].Path
$FileContent = Get-Content -Path $ResolvedFilePath -Raw
$NewFileContent = $FileContent.Replace($OldValue, $NewValue)

Set-Content -Path $ResolvedFilePath -Value $NewFileContent -NoNewline
