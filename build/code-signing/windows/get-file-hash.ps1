Param(
  [Parameter(Mandatory=$True, ValueFromPipeline=$True)]
  $FilePath
)

$Hasher = [System.Security.Cryptography.SHA512]::Create()
$FileContent = Get-Content -Path $FilePath -Encoding Byte -Raw
$Base64Hash = [System.Convert]::ToBase64String($Hasher.ComputeHash($FileContent))

Write-Output $Base64Hash
