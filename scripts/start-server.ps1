$ErrorActionPreference = 'Stop'
$repoDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskDirectory = (Resolve-Path (Join-Path $repoDirectory '../..')).Path
$repoLinux = (wsl -d Ubuntu-22.04 -- wslpath -a $repoDirectory.Replace('\','/')).Trim()
$taskLinux = (wsl -d Ubuntu-22.04 -- wslpath -a $taskDirectory.Replace('\','/')).Trim()
# Linux runtime and esbuild installed in the chat's work/ folder; no global PATH changes.
$bunLinux = "$taskLinux/work/linux-tools/bun-linux-x64"
$esbuildLinux = "$taskLinux/work/linux-esbuild/node_modules/@esbuild/linux-x64/bin/esbuild"
if ($repoLinux -match "'" -or $taskLinux -match "'") { throw 'Checkout path containing single quotes is not supported by this launcher.' }
wsl -d Ubuntu-22.04 -- bash --noprofile --norc -c "cd '$repoLinux' && env PATH='$bunLinux`:/usr/bin:/bin' ESBUILD_BINARY_PATH='$esbuildLinux' bun server/index.ts"
