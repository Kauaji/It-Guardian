#define MyAppName "IT Guardian"
#define MyAppVersion "1.3.0"
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
FinishedLabel=O IT Guardian, o OCS Inventory Agent e o Zabbix Agent 2 foram instalados. O primeiro contato do coletor com o servidor foi validado.

[Files]
Source: "ITGuardian.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "it-guardian.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\agent\windows\diagnose-agent.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Finalize-CollectorInstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Install-MonitoringAgents.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Uninstall-Collector.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "vendor\ocs-extracted\OCS-Windows-Agent-2.11.0.1_x64\OCS-Windows-Agent-Setup-x64.exe"; DestDir: "{app}\packages"; Flags: ignoreversion
Source: "vendor\zabbix_agent2-7.0.29-windows-amd64-openssl.msi"; DestDir: "{app}\packages"; Flags: ignoreversion

[Icons]
Name: "{commondesktop}\Abrir chamado - IT Guardian"; Filename: "{code:GetSupportUrl}"; WorkingDir: "{app}"; IconFilename: "{app}\ITGuardian.exe"
Name: "{commonprograms}\IT Guardian\Desinstalar IT Guardian"; Filename: "{uninstallexe}"; IconFilename: "{app}\ITGuardian.exe"

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\Uninstall-Collector.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "ITGuardianCleanup"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
var
  ProductKeyPage: TInputQueryWizardPage;
  ActivatedProductKey: string;
  AgentToken: string;
  SupportUrl: string;
  OcsServerUrl: string;
  ZabbixServer: string;
  ZabbixServerActive: string;
  MachineFingerprint: string;
  IntervalSeconds: Integer;

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
    OcsServerUrl := JsonStringValue(ResponseBody, 'ocsServerUrl');
    ZabbixServer := JsonStringValue(ResponseBody, 'zabbixServer');
    ZabbixServerActive := JsonStringValue(ResponseBody, 'zabbixServerActive');
    IntervalSeconds := JsonIntegerValue(ResponseBody, 'intervalSeconds', 300);
    if AgentToken = '' then
    begin
      MsgBox('O servidor nao retornou o token do coletor.', mbError, MB_OK);
      Exit;
    end;
    if
      (OcsServerUrl = '') or
      (ZabbixServer = '') or
      (ZabbixServerActive = '') or
      ((Pos('http://', Lowercase(OcsServerUrl)) <> 1) and
       (Pos('https://', Lowercase(OcsServerUrl)) <> 1))
    then
    begin
      AgentToken := '';
      MsgBox(
        'A chave foi validada, mas o servidor nao retornou a configuracao completa do OCS e Zabbix. A instalacao nao foi iniciada.',
        mbError,
        MB_OK
      );
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
begin
  ProductKeyPage := CreateInputQueryPage(
    wpWelcome,
    'Ativar o IT Guardian',
    'Informe a chave de produto',
    'A chave vincula este computador a sua organizacao. Nenhuma outra configuracao e necessaria.'
  );
  ProductKeyPage.Add('Chave de produto:', False);
  MachineFingerprint := ReadMachineFingerprint();
  ActivatedProductKey := '';
  AgentToken := '';
  SupportUrl := '';
  OcsServerUrl := '';
  ZabbixServer := '';
  ZabbixServerActive := '';
  IntervalSeconds := 300;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result :=
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
  ResultCode: Integer;
begin
  if CurStep <> ssPostInstall then Exit;

  ForceDirectories(ExpandConstant('{app}'));
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
    '  "includeLoggedUser": false' + #13#10 +
    '}';
  SaveStringToFile(ExpandConstant('{app}\config.json'), ConfigJson, False);

  if not Exec(
    ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -File "' +
      ExpandConstant('{app}\Finalize-CollectorInstall.ps1') +
      '" -InstallDirectory "' + ExpandConstant('{app}') +
      '" -OcsServerUrl "' + OcsServerUrl +
      '" -ZabbixServer "' + ZabbixServer +
      '" -ZabbixServerActive "' + ZabbixServerActive + '"',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) or (ResultCode <> 0) then
    RaiseException(
      'Nao foi possivel concluir a instalacao do coletor. Consulte o log do instalador.'
    );

  { A chave nunca e gravada. Remova tambem as copias mantidas na memoria do assistente. }
  ActivatedProductKey := '';
  ProductKeyPage.Values[0] := '';
end;
