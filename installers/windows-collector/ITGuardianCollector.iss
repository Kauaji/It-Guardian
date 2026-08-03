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

[Icons]
Name: "{commondesktop}\Abrir chamado - IT Guardian"; Filename: "{code:GetSupportUrl}"; WorkingDir: "{app}"; IconFilename: "{app}\ITGuardian.exe"
Name: "{commonprograms}\IT Guardian\Desinstalar IT Guardian"; Filename: "{app}\ITGuardian-Uninstaller.exe"; IconFilename: "{app}\ITGuardian-Uninstaller.exe"

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Uninstall-Collector.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "ITGuardianCleanup"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
var
  RepairModePage: TInputOptionWizardPage;
  ProductKeyPage: TInputQueryWizardPage;
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

function IsRepairInstall(): Boolean;
begin
  Result := ExistingInstallDetected and (RepairModePage.SelectedValueIndex = 0);
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
    'Instalar ou reparar o IT Guardian',
    'Escolha como continuar',
    'O reparo reinstala os arquivos, recupera o coletor e preserva a ativacao sempre que ela estiver disponivel.',
    True,
    False
  );
  RepairModePage.Add('Instalar ou reparar o IT Guardian (recomendado)');
  if ExistingInstallDetected then
  begin
    RepairModePage.Add('Reativar este computador com uma nova chave');
  end;
  RepairModePage.SelectedValueIndex := 0;
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
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result :=
    ((PageID = ProductKeyPage.ID) and IsRepairInstall() and ExistingConfigAvailable) or
    (PageID = wpSelectDir) or
    (PageID = wpSelectProgramGroup) or
    (PageID = wpSelectTasks);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ProductKey: string;
begin
  Result := True;
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
    ConfigJson :=
      '{' + #13#10 +
      '  "serverUrl": "{#ApiBaseUrl}",' + #13#10 +
      '  "supportUrl": "' + JsonEscape(SupportUrl) + '",' + #13#10 +
      '  "agentToken": "' + JsonEscape(AgentToken) + '",' + #13#10 +
      '  "intervalSeconds": ' + IntToStr(IntervalSeconds) + ',' + #13#10 +
      '  "machineId": "' + JsonEscape(MachineFingerprint) + '",' + #13#10 +
      '  "machineAlias": "",' + #13#10 +
      '  "environment": "",' + #13#10 +
      '  "group": "",' + #13#10 +
      '  "segment": "",' + #13#10 +
      '  "includeLoggedUser": false,' + #13#10 +
      '  "enableRemoteScriptExecution": false' + #13#10 +
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
