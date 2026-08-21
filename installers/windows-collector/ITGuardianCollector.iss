#define MyAppName "IT Guardian"
#define MyAppVersion "1.6.3"
#define MyAppPublisher "IT Guardian"
#ifndef ApiBaseUrl
  #define ApiBaseUrl "https://it-guardian-server.vercel.app"
#endif

[Setup]
AppId={{7CA73097-A67E-4551-94A2-CB11A0F61E91}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={commonappdata}\ITGuardian
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=ITGuardian-Collector-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\ITGuardian.exe
Uninstallable=yes
SetupIconFile=it-guardian.ico
DisableReadyPage=yes

[Messages]
WelcomeLabel1=Bem-vindo a Instalacao do IT Guardian
WelcomeLabel2=Este assistente instalara o IT Guardian neste computador.%n%nO aplicativo coleta inventario real em segundo plano e exibe a presenca do IT Guardian na bandeja do Windows.
FinishedHeadingLabel=Instalacao do IT Guardian concluida
FinishedLabel=O IT Guardian foi instalado. O coletor continuara tentando contato automaticamente se o servidor estiver temporariamente indisponivel.

[Files]
Source: "ITGuardian.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "ITGuardian-Uninstaller.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "it-guardian.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\agent\windows\diagnose-agent.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Finalize-CollectorInstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Uninstall-Collector.ps1"; DestDir: "{app}"; Flags: ignoreversion
#ifdef WebrtcHelperPath
; Processo auxiliar opcional de video WebRTC (ver build-installer.ps1). Sem
; o SDK do .NET disponivel para quem gera o instalador, este define nunca
; chega a existir e o instalador simplesmente sai sem este arquivo -- o
; coletor ja trata a ausencia dele como um aviso, caindo de volta no
; transporte JPEG de sempre, nunca como uma falha de instalacao.
Source: "{#WebrtcHelperPath}"; DestDir: "{app}"; Flags: ignoreversion
#endif

[Icons]
Name: "{commondesktop}\Abrir chamado - IT Guardian"; Filename: "{code:GetSupportUrl}"; WorkingDir: "{app}"; IconFilename: "{app}\ITGuardian.exe"
Name: "{commonprograms}\IT Guardian\Desinstalar IT Guardian"; Filename: "{app}\ITGuardian-Uninstaller.exe"; IconFilename: "{app}\ITGuardian-Uninstaller.exe"

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Uninstall-Collector.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "ITGuardianCleanup"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
const
  ModeInstall = 0;
  ModeRepair = 1;
  ModeChangeKey = 2;
  ModeUninstall = 3;

var
  RepairModePage: TInputOptionWizardPage;
  ProductKeyPage: TInputQueryWizardPage;
  ScriptExecutionPage: TInputOptionWizardPage;
  RemoteAssistancePage: TInputOptionWizardPage;
  ExistingConfig: AnsiString;
  ExistingConfigAvailable: Boolean;
  ExistingInstallDetected: Boolean;
  ActivatedProductKey: string;
  AgentToken: string;
  SupportUrl: string;
  MachineFingerprint: string;
  IntervalSeconds: Integer;

function JsonConfigStringValue(Json, Name: string): string;
var
  Marker: string;
  Position: Integer;
  StartPosition: Integer;
  EndPosition: Integer;
begin
  Result := '';
  Marker := '"' + Name + '"';
  Position := Pos(Marker, Json);
  if Position = 0 then Exit;
  Position := Position + Length(Marker);
  while (Position <= Length(Json)) and (Json[Position] <> ':') do
    Position := Position + 1;
  if Position > Length(Json) then Exit;
  Position := Position + 1;
  while (Position <= Length(Json)) and
    ((Json[Position] = ' ') or (Json[Position] = #9)) do
    Position := Position + 1;
  if (Position > Length(Json)) or (Json[Position] <> '"') then Exit;
  StartPosition := Position + 1;
  EndPosition := StartPosition;
  while (EndPosition <= Length(Json)) and (Json[EndPosition] <> '"') do
    EndPosition := EndPosition + 1;
  Result := Copy(Json, StartPosition, EndPosition - StartPosition);
end;

function SelectedMode(): Integer;
begin
  Result := RepairModePage.SelectedValueIndex;
end;

function IsRepairInstall(): Boolean;
begin
  Result := ExistingInstallDetected and (SelectedMode() = ModeRepair);
end;

function IsUninstallMode(): Boolean;
begin
  Result := ExistingInstallDetected and (SelectedMode() = ModeUninstall);
end;

// Pulada quando o passo de instalacao nao vai reescrever config.json do
// zero (reparo com config existente, desinstalacao, ou "trocar a chave"
// preservando a customizacao ja gravada em disco) -- mostrar o checkbox
// nesses casos seria enganoso, ja que a flag continuaria vindo do
// arquivo existente e nao do que foi marcado na tela.
function ShouldSkipScriptExecutionPage(): Boolean;
begin
  Result :=
    (IsRepairInstall() and ExistingConfigAvailable) or
    IsUninstallMode() or
    ((SelectedMode() = ModeChangeKey) and ExistingConfigAvailable);
end;

// Mesma logica de ShouldSkipScriptExecutionPage: pulada quando o passo de
// instalacao nao vai reescrever config.json do zero, para nao ser enganosa.
function ShouldSkipRemoteAssistancePage(): Boolean;
begin
  Result :=
    (IsRepairInstall() and ExistingConfigAvailable) or
    IsUninstallMode() or
    ((SelectedMode() = ModeChangeKey) and ExistingConfigAvailable);
end;

function JsonEscape(Value: string): string;
begin
  StringChangeEx(Value, '\', '\\', True);
  StringChangeEx(Value, '"', '\"', True);
  StringChangeEx(Value, #13, '\r', True);
  StringChangeEx(Value, #10, '\n', True);
  Result := Value;
end;

function JsonStringValue(Json, Name: string): string;
var
  Marker: string;
  StartPosition: Integer;
  EndPosition: Integer;
begin
  Result := '';
  Marker := '"' + Name + '":"';
  StartPosition := Pos(Marker, Json);
  if StartPosition = 0 then Exit;
  StartPosition := StartPosition + Length(Marker);
  EndPosition := StartPosition;
  while (EndPosition <= Length(Json)) and (Json[EndPosition] <> '"') do
    EndPosition := EndPosition + 1;
  Result := Copy(Json, StartPosition, EndPosition - StartPosition);
end;

function JsonConfigBooleanValue(Json, Name: string; DefaultValue: Boolean): Boolean;
var
  Marker: string;
  Position: Integer;
begin
  Result := DefaultValue;
  Marker := '"' + Name + '"';
  Position := Pos(Marker, Json);
  if Position = 0 then Exit;
  Position := Position + Length(Marker);
  while (Position <= Length(Json)) and (Json[Position] <> ':') do
    Position := Position + 1;
  if Position > Length(Json) then Exit;
  Position := Position + 1;
  while (Position <= Length(Json)) and
    ((Json[Position] = ' ') or (Json[Position] = #9)) do
    Position := Position + 1;
  Result := Copy(Json, Position, 4) = 'true';
end;

function BoolToJson(Value: Boolean): string;
begin
  if Value then
    Result := 'true'
  else
    Result := 'false';
end;

function JsonIntegerValue(Json, Name: string; DefaultValue: Integer): Integer;
var
  Marker: string;
  Position: Integer;
  Digits: string;
begin
  Result := DefaultValue;
  Digits := '';
  Marker := '"' + Name + '":';
  Position := Pos(Marker, Json);
  if Position = 0 then Exit;
  Position := Position + Length(Marker);
  while (Position <= Length(Json)) and
    (Json[Position] >= '0') and (Json[Position] <= '9') do
  begin
    Digits := Digits + Json[Position];
    Position := Position + 1;
  end;
  if Digits <> '' then
    Result := StrToInt(Digits);
end;

function ReadMachineFingerprint(): string;
begin
  Result := '';
  if IsWin64 then
    RegQueryStringValue(HKLM64, 'SOFTWARE\Microsoft\Cryptography', 'MachineGuid', Result)
  else
    RegQueryStringValue(HKLM32, 'SOFTWARE\Microsoft\Cryptography', 'MachineGuid', Result);
  if Result = '' then
    Result := GetEnv('COMPUTERNAME') + '-' + GetEnv('PROCESSOR_IDENTIFIER');
end;

function ActivateCollector(ProductKey: string): Boolean;
var
  Http: Variant;
  RequestBody: string;
  ResponseBody: string;
  ErrorMessage: string;
begin
  Result := False;
  WizardForm.NextButton.Enabled := False;
  WizardForm.StatusLabel.Caption := 'Validando chave e ativando este computador...';
  try
    Http := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Http.SetTimeouts(10000, 10000, 15000, 15000);
    Http.Open('POST', '{#ApiBaseUrl}/api/collector/activate', False);
    Http.SetRequestHeader('Content-Type', 'application/json');
    RequestBody :=
      '{"productKey":"' + JsonEscape(ProductKey) +
      '","machineFingerprint":"' + JsonEscape(MachineFingerprint) +
      '","hostname":"' + JsonEscape(GetEnv('COMPUTERNAME')) +
      '","collectorVersion":"{#MyAppVersion}"}';
    Http.Send(RequestBody);
    ResponseBody := Http.ResponseText;

    if Http.Status <> 201 then
    begin
      ErrorMessage := JsonStringValue(ResponseBody, 'message');
      if ErrorMessage = '' then
        ErrorMessage := 'A ativacao foi recusada pelo servidor (HTTP ' + IntToStr(Http.Status) + ').';
      MsgBox(ErrorMessage, mbError, MB_OK);
      Exit;
    end;

    AgentToken := JsonStringValue(ResponseBody, 'agentToken');
    SupportUrl := JsonStringValue(ResponseBody, 'supportUrl');
    IntervalSeconds := JsonIntegerValue(ResponseBody, 'intervalSeconds', 300);
    if AgentToken = '' then
    begin
      MsgBox('O servidor nao retornou o token do coletor.', mbError, MB_OK);
      Exit;
    end;
    if SupportUrl = '' then
      SupportUrl := '{#ApiBaseUrl}/abrir-chamado';

    ActivatedProductKey := ProductKey;
    Result := True;
  except
    MsgBox(
      'Nao foi possivel conectar ao IT Guardian. Verifique a internet e tente novamente.',
      mbError,
      MB_OK
    );
  end;
  WizardForm.StatusLabel.Caption := '';
  WizardForm.NextButton.Enabled := True;
end;

function GetSupportUrl(Param: string): string;
begin
  if SupportUrl = '' then
    Result := '{#ApiBaseUrl}/abrir-chamado'
  else
    Result := SupportUrl;
end;

procedure InitializeWizard();
var
  ProductKeyAfterId: Integer;
  ExistingConfigPath: string;
begin
  ExistingConfigPath := ExpandConstant('{commonappdata}\ITGuardian\config.json');
  ExistingConfig := '';
  ExistingConfigAvailable :=
    LoadStringFromFile(ExistingConfigPath, ExistingConfig) and
    (JsonConfigStringValue(ExistingConfig, 'agentToken') <> '');
  ExistingInstallDetected :=
    DirExists(ExpandConstant('{commonappdata}\ITGuardian')) or
    FileExists(ExpandConstant('{commonappdata}\ITGuardian-install-finalize.log'));

  RepairModePage := CreateInputOptionPage(
    wpWelcome,
    'O que voce deseja fazer?',
    'Escolha uma opcao para continuar',
    'Se este e o primeiro uso do IT Guardian neste computador, escolha "Instalar". ' +
    'As demais opcoes exigem uma instalacao existente.',
    True,
    False
  );
  RepairModePage.Add('Instalar o IT Guardian');
  RepairModePage.Add('Reparar o IT Guardian (reinstala os arquivos e mantem a ativacao)');
  RepairModePage.Add('Trocar a chave de produto (reativa este computador)');
  RepairModePage.Add('Desinstalar o IT Guardian');
  if ExistingInstallDetected then
    RepairModePage.SelectedValueIndex := ModeRepair
  else
    RepairModePage.SelectedValueIndex := ModeInstall;
  ProductKeyAfterId := RepairModePage.ID;

  if ExistingConfigAvailable then
  begin
    SupportUrl := JsonConfigStringValue(ExistingConfig, 'supportUrl');
  end;

  ProductKeyPage := CreateInputQueryPage(
    ProductKeyAfterId,
    'Ativar o IT Guardian',
    'Informe a chave de produto',
    'A chave vincula este computador a sua organizacao. Nenhuma outra configuracao e necessaria.'
  );
  ProductKeyPage.Add('Chave de produto:', False);
  ProductKeyPage.Values[0] := '';
  MachineFingerprint := ReadMachineFingerprint();
  ActivatedProductKey := '';
  AgentToken := '';
  if not ExistingConfigAvailable then
    SupportUrl := '';
  IntervalSeconds := 300;

  ScriptExecutionPage := CreateInputOptionPage(
    ProductKeyPage.ID,
    'Execucao real de scripts (opcional)',
    'Apenas para laboratorio/homologacao com supervisao',
    'Por padrao esta opcao fica desligada e o IT Guardian so registra/simula scripts de manutencao. ' +
    'Quando ligada, este computador podera executar de verdade scripts BAT/CMD/PowerShell enviados ' +
    'pelo servidor -- sempre com confirmacao, controle duplo para risco alto/critico e auditoria completa. ' +
    'So marque esta opcao se voce sabe o que esta fazendo.',
    False,
    False
  );
  ScriptExecutionPage.Add('Habilitar execucao real de scripts nesta maquina (enableRemoteScriptExecution)');
  ScriptExecutionPage.Values[0] :=
    CompareText(ExpandConstant('{param:EnableRemoteScriptExecution|0}'), '1') = 0;

  RemoteAssistancePage := CreateInputOptionPage(
    ScriptExecutionPage.ID,
    'Assistencia remota (opcional)',
    'Permite que um tecnico veja a tela e, com consentimento, controle esta maquina',
    'Por padrao esta opcao fica desligada e nenhuma sessao de assistencia remota pode ser aberta ' +
    'nesta maquina. Quando ligada, um tecnico podera solicitar uma sessao de tela -- sempre exige ' +
    'consentimento explicito na hora, mostrado nesta maquina antes de qualquer captura comecar. ' +
    'Sem essa opcao ligada, o pedido do tecnico fica esperando para sempre, sem nenhum aviso aparecer aqui.',
    False,
    False
  );
  RemoteAssistancePage.Add('Habilitar assistencia remota nesta maquina (enableRemoteAssistance)');
  RemoteAssistancePage.Values[0] :=
    CompareText(ExpandConstant('{param:EnableRemoteAssistance|0}'), '1') = 0;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result :=
    ((PageID = ProductKeyPage.ID) and
      ((IsRepairInstall() and ExistingConfigAvailable) or IsUninstallMode())) or
    ((PageID = ScriptExecutionPage.ID) and ShouldSkipScriptExecutionPage()) or
    ((PageID = RemoteAssistancePage.ID) and ShouldSkipRemoteAssistancePage()) or
    (PageID = wpSelectDir) or
    (PageID = wpSelectProgramGroup) or
    (PageID = wpSelectTasks);
end;

function LaunchExistingUninstaller(): Boolean;
var
  UninstallerPath: string;
  ResultCode: Integer;
begin
  Result := False;
  UninstallerPath := ExpandConstant('{commonappdata}\ITGuardian\unins000.exe');
  if not FileExists(UninstallerPath) then
  begin
    MsgBox(
      'O desinstalador do IT Guardian nao foi encontrado neste computador. ' +
      'Use "Aplicativos instalados" do Windows para remover o IT Guardian.',
      mbError,
      MB_OK
    );
    Exit;
  end;

  if MsgBox(
    'Isso vai remover o IT Guardian deste computador, incluindo o coletor e a ativacao. Deseja continuar?',
    mbConfirmation,
    MB_YESNO
  ) <> IDYES then Exit;

  if not Exec(UninstallerPath, '/SILENT', '', SW_SHOW, ewNoWait, ResultCode) then
  begin
    MsgBox('Nao foi possivel iniciar a desinstalacao.', mbError, MB_OK);
    Exit;
  end;
  Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ProductKey: string;
begin
  Result := True;

  if CurPageID = RepairModePage.ID then
  begin
    if (SelectedMode() <> ModeInstall) and (not ExistingInstallDetected) then
    begin
      MsgBox(
        'Nenhuma instalacao existente foi encontrada neste computador. ' +
        'Escolha "Instalar o IT Guardian" para continuar.',
        mbError,
        MB_OK
      );
      Result := False;
      Exit;
    end;
    if IsUninstallMode() then
    begin
      if LaunchExistingUninstaller() then
        Abort
      else
        Result := False;
    end;
    Exit;
  end;

  if CurPageID <> ProductKeyPage.ID then Exit;

  ProductKey := Uppercase(Trim(ProductKeyPage.Values[0]));
  if ProductKey = '' then
  begin
    MsgBox('Informe a chave de produto para continuar.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if (ActivatedProductKey = ProductKey) and (AgentToken <> '') then Exit;
  Result := ActivateCollector(ProductKey);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigJson: string;
  FinalizeParameters: string;
  ResultCode: Integer;
  PreserveCustomization: Boolean;
  PreservedMachineAlias: string;
  PreservedEnvironment: string;
  PreservedGroup: string;
  PreservedSegment: string;
  PreservedIncludeLoggedUser: Boolean;
  PreservedEnableRemoteScriptExecution: Boolean;
  PreservedEnableRemoteAssistance: Boolean;
begin
  if CurStep <> ssPostInstall then Exit;

  ForceDirectories(ExpandConstant('{app}'));
  if IsRepairInstall() and ExistingConfigAvailable then
  begin
    if not FileExists(ExpandConstant('{app}\config.json')) then
      RaiseException('A configuracao existente nao foi encontrada durante o reparo.');
  end
  else
  begin
    { "Trocar a chave de produto" reativa o computador, mas nao deve descartar
      customizacoes locais (alias, ambiente, grupo, segmento, flags) feitas
      apos a instalacao original -- so os dados ligados a ativacao em si
      (servidor, token, suporte, intervalo) sao de fato renovados. }
    PreserveCustomization := (SelectedMode() = ModeChangeKey) and ExistingConfigAvailable;
    if PreserveCustomization then
    begin
      PreservedMachineAlias := JsonConfigStringValue(ExistingConfig, 'machineAlias');
      PreservedEnvironment := JsonConfigStringValue(ExistingConfig, 'environment');
      PreservedGroup := JsonConfigStringValue(ExistingConfig, 'group');
      PreservedSegment := JsonConfigStringValue(ExistingConfig, 'segment');
      PreservedIncludeLoggedUser := JsonConfigBooleanValue(ExistingConfig, 'includeLoggedUser', False);
      PreservedEnableRemoteScriptExecution := JsonConfigBooleanValue(ExistingConfig, 'enableRemoteScriptExecution', False);
      PreservedEnableRemoteAssistance := JsonConfigBooleanValue(ExistingConfig, 'enableRemoteAssistance', False);
    end
    else
    begin
      PreservedMachineAlias := '';
      PreservedEnvironment := '';
      PreservedGroup := '';
      PreservedSegment := '';
      PreservedIncludeLoggedUser := False;
      PreservedEnableRemoteScriptExecution := ScriptExecutionPage.Values[0];
      PreservedEnableRemoteAssistance := RemoteAssistancePage.Values[0];
    end;

    ConfigJson :=
      '{' + #13#10 +
      '  "serverUrl": "{#ApiBaseUrl}",' + #13#10 +
      '  "supportUrl": "' + JsonEscape(SupportUrl) + '",' + #13#10 +
      '  "agentToken": "' + JsonEscape(AgentToken) + '",' + #13#10 +
      '  "intervalSeconds": ' + IntToStr(IntervalSeconds) + ',' + #13#10 +
      '  "machineId": "' + JsonEscape(MachineFingerprint) + '",' + #13#10 +
      '  "machineAlias": "' + JsonEscape(PreservedMachineAlias) + '",' + #13#10 +
      '  "environment": "' + JsonEscape(PreservedEnvironment) + '",' + #13#10 +
      '  "group": "' + JsonEscape(PreservedGroup) + '",' + #13#10 +
      '  "segment": "' + JsonEscape(PreservedSegment) + '",' + #13#10 +
      '  "includeLoggedUser": ' + BoolToJson(PreservedIncludeLoggedUser) + ',' + #13#10 +
      '  "enableRemoteScriptExecution": ' + BoolToJson(PreservedEnableRemoteScriptExecution) + ',' + #13#10 +
      '  "enableRemoteAssistance": ' + BoolToJson(PreservedEnableRemoteAssistance) + #13#10 +
      '}';
    SaveStringToFile(ExpandConstant('{app}\config.json'), ConfigJson, False);
  end;

  FinalizeParameters :=
    '-NoProfile -ExecutionPolicy Bypass -File "' +
    ExpandConstant('{app}\Finalize-CollectorInstall.ps1') +
    '" -InstallDirectory "' + ExpandConstant('{app}') + '"';

  if not Exec(
    ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    FinalizeParameters,
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) or (ResultCode <> 0) then
    RaiseException(
      'Nao foi possivel concluir a instalacao do coletor. Consulte ' +
      ExpandConstant('{commonappdata}\ITGuardian-install-finalize.log') + '.'
    );

  { A chave nunca e gravada. Remova tambem as copias mantidas na memoria do assistente. }
  ActivatedProductKey := '';
  ProductKeyPage.Values[0] := '';
end;
