Param(
  [Parameter(Mandatory=$True, ValueFromPipeline=$True)]
  [String]
  $FilePath,

  [Parameter()]
  [String]
  $SignToolExecutable = "signtool",

  [Parameter()]
  [String]
  $TimestampServer = "http://rfc3161timestamp.globalsign.com/advanced"
)

$CertificateFilePath = "$PSScriptRoot/5minds-code-signing.cer"
$ContainerName = "te-48a208f5-b39e-46c2-9bd5-2a3ec2eae19f"
$TokenPassword = $Env:TOKEN_PASSWORD
$Key = "[{{$TokenPassword}}]=$ContainerName"

if (!$TokenPassword) {
  throw "Environment variable 'TOKEN_PASSWORD' is not set"
}

& $SignToolExecutable "sign" `
    "/f" $CertificateFilePath `
    "/csp" "eToken Base Cryptographic Provider" `
    "/k" $Key `
    "/tr" $TimestampServer `
    "/td" "SHA256" `
    $FilePath

if ($LASTEXITCODE -ne 0) {
  throw "signtool exited with code $LASTEXITCODE. There is likely additional logging output above."
}
