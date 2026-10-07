[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://it-guardian-server.vercel.app",
  [string]$OutputDirectory = "",
  # Chave PUBLICA de release (ECDSA P-256, base64 de SubjectPublicKeyInfo) embutida no instalador:
  # sem ela o agente instalado IGNORA atualizacoes automaticas. Se omitida, usa o conteudo de
  # installers/windows-collector/release-public-key.txt quando o arquivo existir.
  [string]$ReleasePublicKey = "",
  # Opcional: chave publica de assinatura de jobs a embutir. Normalmente NAO e necessaria: o servidor
  # a entrega na ativacao (confianca no primeiro uso sobre TLS).
  [string]$JobSigningPublicKey = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $PSScriptRoot "output"
}

# --- Assinatura de codigo (Authenticode) -----------------------------------
# Desligada por padrao: sem certificado configurado, o build funciona
# exatamente como antes (executaveis nao assinados). Quando um certificado
# for adquirido, ligar via variaveis de ambiente -- nenhuma mudanca de
# codigo necessaria:
#
#   IT_GUARDIAN_CODE_SIGN_PFX           caminho do arquivo .pfx/.p12
#   IT_GUARDIAN_CODE_SIGN_PFX_PASSWORD  senha do .pfx
#   -- ou, para certificado em token/HSM ja instalado no repositorio do Windows --
#   IT_GUARDIAN_CODE_SIGN_THUMBPRINT    thumbprint do certificado
#
#   IT_GUARDIAN_CODE_SIGN_TIMESTAMP_URL opcional, RFC3161 (default: DigiCert)
#   SIGNTOOL_PATH                       opcional, caminho direto do signtool.exe
function Find-SignTool {
  if (-not [string]::IsNullOrWhiteSpace($env:SIGNTOOL_PATH)) {
    if (Test-Path -LiteralPath $env:SIGNTOOL_PATH) { return $env:SIGNTOOL_PATH }
    throw "SIGNTOOL_PATH definido mas o arquivo nao existe: $env:SIGNTOOL_PATH"
  }
  $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
  if (-not (Test-Path -LiteralPath $kitsRoot)) { return $null }
  return Get-ChildItem -LiteralPath $kitsRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "x64\signtool.exe" } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}

function Invoke-CodeSigning {
  param([Parameter(Mandatory)] [string]$FilePath)

  $hasPfx = -not [string]::IsNullOrWhiteSpace($env:IT_GUARDIAN_CODE_SIGN_PFX)
  $hasThumbprint = -not [string]::IsNullOrWhiteSpace($env:IT_GUARDIAN_CODE_SIGN_THUMBPRINT)
  if (-not $hasPfx -and -not $hasThumbprint) {
    return $false
  }

  $signtool = Find-SignTool
  if (-not $signtool) {
    throw "Certificado de assinatura configurado, mas signtool.exe nao foi encontrado. Instale o Windows SDK ou defina SIGNTOOL_PATH."
  }

  $timestampUrl = if ([string]::IsNullOrWhiteSpace($env:IT_GUARDIAN_CODE_SIGN_TIMESTAMP_URL)) {
    "http://timestamp.digicert.com"
  } else {
    $env:IT_GUARDIAN_CODE_SIGN_TIMESTAMP_URL
  }

  $signArgs = @("sign", "/fd", "SHA256", "/tr", $timestampUrl, "/td", "SHA256")
  if ($hasPfx) {
    $signArgs += @("/f", $env:IT_GUARDIAN_CODE_SIGN_PFX)
    if (-not [string]::IsNullOrWhiteSpace($env:IT_GUARDIAN_CODE_SIGN_PFX_PASSWORD)) {
      $signArgs += @("/p", $env:IT_GUARDIAN_CODE_SIGN_PFX_PASSWORD)
    }
  } else {
    $signArgs += @("/sha1", $env:IT_GUARDIAN_CODE_SIGN_THUMBPRINT)
  }
  $signArgs += $FilePath

  & $signtool @signArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao assinar $FilePath (signtool saiu com codigo $LASTEXITCODE)."
  }
  Write-Host "Assinado: $FilePath" -ForegroundColor Green
  return $true
}

$iconPath = Join-Path $PSScriptRoot "it-guardian.ico"
$executablePath = Join-Path $PSScriptRoot "ITGuardian.exe"
$uninstallerExecutablePath = Join-Path $PSScriptRoot "ITGuardian-Uninstaller.exe"
$sourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.Windows.cs"
$remoteAssistanceSourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.RemoteAssistance.cs"
$rustdeskControllerSourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.RustdeskController.cs"
# Politica de confianca (assinatura ECDSA, anti-replay), configuracao e log: testados em agent\windows\tests.
$loggingSourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.Logging.cs"
$signingSourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.Signing.cs"
$policySourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.Policy.cs"
$configSourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.Config.cs"
$agentSourcePaths = @(
  $sourcePath,
  $remoteAssistanceSourcePath,
  $rustdeskControllerSourcePath,
  $loggingSourcePath,
  $signingSourcePath,
  $policySourcePath,
  $configSourcePath
)
$uninstallerSourcePath = Join-Path $PSScriptRoot "ITGuardian.Uninstaller.cs"
$iconScriptPath = Join-Path $PSScriptRoot "New-ITGuardianIcon.ps1"
$frameworkDirectory = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319"
$csharpCompiler = Join-Path $frameworkDirectory "csc.exe"
$webrtcProjectPath = Join-Path $PSScriptRoot "..\..\agent\windows\webrtc\ITGuardian.RemoteAssistanceWebRtc.csproj"
$webrtcPublishDir = Join-Path $PSScriptRoot "webrtc-publish"

if (-not (Test-Path -LiteralPath $csharpCompiler)) {
  throw "Compilador .NET Framework x64 nao encontrado."
}
if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Codigo-fonte do aplicativo Windows nao encontrado."
}
if (-not (Test-Path -LiteralPath $remoteAssistanceSourcePath)) {
  throw "Codigo-fonte da assistencia remota nao encontrado."
}
if (-not (Test-Path -LiteralPath $rustdeskControllerSourcePath)) {
  throw "Codigo-fonte do controlador RustDesk nao encontrado."
}
foreach ($agentSource in $agentSourcePaths) {
  if (-not (Test-Path -LiteralPath $agentSource)) {
    throw "Codigo-fonte do agente nao encontrado: $agentSource"
  }
}
if (-not (Test-Path -LiteralPath $uninstallerSourcePath)) {
  throw "Codigo-fonte do desinstalador Windows nao encontrado."
}
& $iconScriptPath -OutputPath $iconPath
& $csharpCompiler `
  /nologo `
  /target:winexe `
  /optimize+ `
  /platform:x64 `
  "/win32icon:$iconPath" `
  "/out:$executablePath" `
  "/reference:$(Join-Path $frameworkDirectory 'System.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Core.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Drawing.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Management.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Numerics.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Web.Extensions.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Windows.Forms.dll')" `
  @agentSourcePaths
if ($LASTEXITCODE -ne 0) {
  throw "A compilacao do ITGuardian.exe falhou com codigo $LASTEXITCODE."
}
Invoke-CodeSigning -FilePath $executablePath | Out-Null

& $csharpCompiler `
  /nologo `
  /target:winexe `
  /optimize+ `
  /platform:x64 `
  "/win32icon:$iconPath" `
  "/out:$uninstallerExecutablePath" `
  "/reference:$(Join-Path $frameworkDirectory 'System.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Windows.Forms.dll')" `
  $uninstallerSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "A compilacao do ITGuardian-Uninstaller.exe falhou com codigo $LASTEXITCODE."
}
Invoke-CodeSigning -FilePath $uninstallerExecutablePath | Out-Null

# --- Processo auxiliar de video WebRTC (opcional) --------------------------
# Video real por WebRTC roda num processo separado do coletor principal,
# porque depende de bibliotecas gerenciadas (SIPSorcery) que exigem .NET 10 --
# o coletor em si continua compilado via csc.exe/net48 acima, sem nenhuma
# mudanca de runtime. O SDK do .NET e opcional para QUEM GERA O INSTALADOR:
# sem ele, o build simplesmente segue sem esse processo auxiliar, e o coletor
# no computador do cliente cai de volta no transporte JPEG de sempre (o
# broker ja trata a ausencia do executavel como um aviso, nao como erro).
function Test-DotnetHasSdk {
  param([Parameter(Mandatory)] [string]$DotnetPath)
  try {
    $sdks = & $DotnetPath --list-sdks 2>$null
    return [bool]($sdks | Where-Object { $_ })
  } catch {
    return $false
  }
}

function Find-DotnetExecutable {
  # dotnet.exe pode existir em mais de um lugar (ex.: um runtime global em
  # Program Files, sem SDK nenhum instalado) -- o que importa e achar um que
  # realmente tenha um SDK, nao so o primeiro executavel no PATH.
  $candidates = [Collections.Generic.List[string]]::new()
  $onPath = Get-Command dotnet -ErrorAction SilentlyContinue
  if ($onPath) { $candidates.Add($onPath.Source) }
  $candidates.Add((Join-Path $env:LOCALAPPDATA "Microsoft\dotnet\dotnet.exe"))
  foreach ($candidate in $candidates) {
    if ((Test-Path -LiteralPath $candidate) -and (Test-DotnetHasSdk -DotnetPath $candidate)) {
      return $candidate
    }
  }
  return $null
}

$webrtcHelperPath = $null
$dotnetExecutable = Find-DotnetExecutable
if (-not $dotnetExecutable) {
  Write-Host "Aviso: .NET SDK nao encontrado -- instalador sera gerado sem o transporte WebRTC (video continua por JPEG)." -ForegroundColor Yellow
} elseif (-not (Test-Path -LiteralPath $webrtcProjectPath)) {
  Write-Host "Aviso: projeto do processo auxiliar de WebRTC nao encontrado -- instalador sera gerado sem ele." -ForegroundColor Yellow
} else {
  if (Test-Path -LiteralPath $webrtcPublishDir) {
    Remove-Item -LiteralPath $webrtcPublishDir -Recurse -Force
  }
  & $dotnetExecutable publish $webrtcProjectPath `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -o $webrtcPublishDir
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Aviso: falha ao publicar o processo auxiliar de WebRTC (codigo $LASTEXITCODE) -- instalador sera gerado sem ele." -ForegroundColor Yellow
  } else {
    $candidateHelperPath = Join-Path $webrtcPublishDir "ITGuardianRemoteAssistanceWebRtc.exe"
    if (Test-Path -LiteralPath $candidateHelperPath) {
      $webrtcHelperPath = $candidateHelperPath
      Invoke-CodeSigning -FilePath $webrtcHelperPath | Out-Null
    } else {
      Write-Host "Aviso: publicacao do processo auxiliar de WebRTC nao gerou o executavel esperado -- instalador sera gerado sem ele." -ForegroundColor Yellow
    }
  }
}

# --- Instalador do RustDesk (opcional) --------------------------------------
# O IT Guardian nao redistribui o RustDesk por conta propria. Se
# installers/windows-collector/vendor/rustdesk-installer.exe ja existir (voce
# baixou manualmente, ou um build anterior ja baixou), ele e reaproveitado
# sem nova tentativa de rede. Caso contrario, o script tenta baixar
# automaticamente a ultima release oficial do GitHub -- e so uma
# conveniencia: sem internet, sem acesso ao GitHub, ou se o padrao de nome do
# asset mudar numa release futura, o download falha silenciosamente e o build
# segue sem o RustDesk (mesma logica de "ausencia nunca e erro" do helper
# WebRTC acima) -- Finalize-CollectorInstall.ps1 ja trata a ausencia do
# instalador embutido como aviso, nao como falha. Para pular o download
# automatico (ambiente sem saida para a internet), defina
# $env:RUSTDESK_SKIP_AUTO_DOWNLOAD = "1" antes de rodar este script.
$rustdeskInstallerVendorPath = Join-Path $PSScriptRoot "vendor\rustdesk-installer.exe"
if (-not (Test-Path -LiteralPath $rustdeskInstallerVendorPath) -and -not $env:RUSTDESK_SKIP_AUTO_DOWNLOAD) {
  Write-Host "Instalador do RustDesk nao encontrado em vendor/; tentando baixar a ultima release oficial..." -ForegroundColor Yellow
  try {
    $release = Invoke-RestMethod `
      -Uri "https://api.github.com/repos/rustdesk/rustdesk/releases/latest" `
      -Headers @{ "User-Agent" = "ITGuardian-Installer-Build" } `
      -TimeoutSec 20
    $asset = $release.assets |
      Where-Object { $_.name -match "^rustdesk-.*-x86_64\.exe$" -and $_.name -notmatch "sciter" } |
      Select-Object -First 1
    if (-not $asset) {
      $asset = $release.assets | Where-Object { $_.name -match "^rustdesk-.*\.exe$" } | Select-Object -First 1
    }
    if ($asset) {
      New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot "vendor") | Out-Null
      Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $rustdeskInstallerVendorPath -TimeoutSec 120
      Write-Host "RustDesk $($release.tag_name) baixado automaticamente ($($asset.name))." -ForegroundColor Green
    } else {
      Write-Host "Aviso: nenhum instalador x86_64 encontrado na ultima release do RustDesk -- baixe manualmente se precisar dele." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Aviso: download automatico do RustDesk falhou ($($_.Exception.Message)) -- baixe manualmente para vendor/rustdesk-installer.exe se precisar dele." -ForegroundColor Yellow
  }
}
if (Test-Path -LiteralPath $rustdeskInstallerVendorPath) {
  Write-Host "Instalador do RustDesk encontrado; sera empacotado junto do coletor." -ForegroundColor Green
} else {
  Write-Host "Aviso: instalador sera gerado sem o RustDesk." -ForegroundColor Yellow
  $rustdeskInstallerVendorPath = $null
}

$uri = $null
if (
  -not [Uri]::TryCreate($ApiBaseUrl, [UriKind]::Absolute, [ref]$uri) -or
  $uri.Scheme -notin @("http", "https")
) {
  throw "ApiBaseUrl deve ser uma URL HTTP ou HTTPS valida."
}
if (
  $uri.Scheme -ne "https" -and
  $uri.Host -notin @("localhost", "127.0.0.1", "::1")
) {
  throw "A API cloud deve usar HTTPS. HTTP e aceito apenas para testes locais."
}

$candidates = [Collections.Generic.List[string]]::new()
if (-not [string]::IsNullOrWhiteSpace($env:INNO_SETUP_COMPILER)) {
  $candidates.Add($env:INNO_SETUP_COMPILER)
}
foreach ($root in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
  if (-not [string]::IsNullOrWhiteSpace($root)) {
    $candidates.Add((Join-Path $root "Inno Setup 6\ISCC.exe"))
  }
}
$compiler = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) {
  throw "Inno Setup 6 nao encontrado. Instale-o ou defina INNO_SETUP_COMPILER."
}

$requiredSources = @(
  (Join-Path $PSScriptRoot "ITGuardianCollector.iss"),
  (Join-Path $PSScriptRoot "Finalize-CollectorInstall.ps1"),
  (Join-Path $PSScriptRoot "Uninstall-Collector.ps1"),
  $executablePath,
  $uninstallerExecutablePath,
  $iconPath,
  (Join-Path $PSScriptRoot "..\..\agent\windows\diagnose-agent.ps1")
)
foreach ($source in $requiredSources) {
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Arquivo obrigatorio do instalador nao encontrado: $source"
  }
}

$resolvedOutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null
$isccArgs = [Collections.Generic.List[string]]::new()
$isccArgs.Add("/DApiBaseUrl=$($ApiBaseUrl.TrimEnd('/'))")
# Chaves publicas de confianca (assinatura de atualizacao e de jobs). Formato validado aqui para
# nunca embutir lixo: SPKI DER de P-256 = 91 bytes, prefixo fixo "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE".
function Test-P256PublicKeyShape {
  param([string]$Value)
  return $Value -match '^MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE[A-Za-z0-9+/]{86}==$'
}
$releaseKeyFile = Join-Path $PSScriptRoot "release-public-key.txt"
if ([string]::IsNullOrWhiteSpace($ReleasePublicKey) -and (Test-Path -LiteralPath $releaseKeyFile)) {
  $ReleasePublicKey = (Get-Content -LiteralPath $releaseKeyFile -Encoding UTF8 |
    Where-Object { $_ -and -not $_.TrimStart().StartsWith("#") } |
    Select-Object -First 1)
  Write-Host "Chave publica de release lida de release-public-key.txt." -ForegroundColor Green
}
$ReleasePublicKey = "$ReleasePublicKey".Trim()
$JobSigningPublicKey = "$JobSigningPublicKey".Trim()
if ($ReleasePublicKey) {
  if (-not (Test-P256PublicKeyShape $ReleasePublicKey)) {
    throw "ReleasePublicKey invalida: esperado base64 de SubjectPublicKeyInfo ECDSA P-256 (124 caracteres, gerado por 'npm run agent:keys -- release')."
  }
  $isccArgs.Add("/DReleasePublicKey=$ReleasePublicKey")
  Write-Host "Instalador embute a chave publica de release: atualizacoes automaticas exigem assinatura." -ForegroundColor Green
} else {
  Write-Host "Aviso: sem chave publica de release (-ReleasePublicKey ou release-public-key.txt). O agente instalado IGNORARA atualizacoes automaticas ate receber releasePublicKey no config.json." -ForegroundColor Yellow
}
if ($JobSigningPublicKey) {
  if (-not (Test-P256PublicKeyShape $JobSigningPublicKey)) {
    throw "JobSigningPublicKey invalida: esperado base64 de SubjectPublicKeyInfo ECDSA P-256 (124 caracteres)."
  }
  $isccArgs.Add("/DJobSigningPublicKey=$JobSigningPublicKey")
}
# Relay RustDesk proprio (opcional): lido de variaveis de ambiente no momento
# do build, nao de parametro de linha de comando, porque sao valores de
# infraestrutura fixos da organizacao (o mesmo relay para toda a frota), nao
# algo que muda por execucao do script -- mesmo raciocinio de ApiBaseUrl
# acima, so que sem valor padrao (vazio = cliente RustDesk continua no relay
# publico de fabrica ate alguem configurar isto).
if (-not [string]::IsNullOrWhiteSpace($env:RUSTDESK_ID_SERVER)) {
  $isccArgs.Add("/DRustdeskIdServer=$($env:RUSTDESK_ID_SERVER)")
}
if (-not [string]::IsNullOrWhiteSpace($env:RUSTDESK_RELAY_SERVER)) {
  $isccArgs.Add("/DRustdeskRelayServer=$($env:RUSTDESK_RELAY_SERVER)")
}
if (-not [string]::IsNullOrWhiteSpace($env:RUSTDESK_KEY)) {
  $isccArgs.Add("/DRustdeskKey=$($env:RUSTDESK_KEY)")
}
if ($webrtcHelperPath) {
  $isccArgs.Add("/DWebrtcHelperPath=$webrtcHelperPath")
}
if ($rustdeskInstallerVendorPath) {
  $isccArgs.Add("/DRustdeskInstallerPath=$rustdeskInstallerVendorPath")
}
$isccArgs.Add("/O$resolvedOutputDirectory")
$isccArgs.Add((Join-Path $PSScriptRoot "ITGuardianCollector.iss"))
& $compiler @isccArgs
if ($LASTEXITCODE -ne 0) {
  throw "A compilacao do instalador falhou com codigo $LASTEXITCODE."
}
if ($webrtcHelperPath) {
  Write-Host "Instalador inclui o transporte WebRTC (video em tempo real)." -ForegroundColor Green
} else {
  Write-Host "Instalador gerado sem o transporte WebRTC (video continua por JPEG)." -ForegroundColor Yellow
}
if ($rustdeskInstallerVendorPath) {
  Write-Host "Instalador inclui o cliente RustDesk (transporte alternativo)." -ForegroundColor Green
}
$installerExecutablePath = Join-Path $resolvedOutputDirectory "ITGuardian-Collector-Setup.exe"
$signedInstaller = Invoke-CodeSigning -FilePath $installerExecutablePath

if (-not $signedInstaller) {
  Write-Host "Aviso: executaveis nao assinados (nenhum certificado configurado). Veja IT_GUARDIAN_CODE_SIGN_* no topo deste script." -ForegroundColor Yellow
}
Write-Host "Instalador criado em $resolvedOutputDirectory" -ForegroundColor Green
