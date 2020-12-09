$FileToHash = (Get-ChildItem .\dist\electron\bpmn-studio-*.exe)[0].FullName
Write-Output "Signing $FileToHash"

$HashBeforeSigning = .\build\code-signing\windows\get-file-hash.ps1 -FilePath $FileToHash
.\build\code-signing\windows\sign-app.ps1 -FilePath $FileToHash
$HashAfterSigning = .\build\code-signing\windows\get-file-hash.ps1 -FilePath $FileToHash

# electron-builder generates a checksum for the unsigned installer after building it.
# The checksum will obviously change after signing the installer, so the old checksum
# needs to be replaced.
Write-Output "Updating checksum in $((Get-ChildItem .\dist\electron\*.yml).Name)"
Write-Output "Old checksum: $HashBeforeSigning"
Write-Output "New checksum: $HashAfterSigning"

.\build\code-signing\windows\replace-value-in-file.ps1 `
  -FilePath .\dist\electron\*.yml `
  -OldValue $HashBeforeSigning `
  -NewValue $HashAfterSigning
