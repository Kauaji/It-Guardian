export const ocsInventory = [
  {
    hostId: "srv-web-01",
    manufacturer: "Dell",
    model: "PowerEdge R450",
    assetTag: "ATV-SRV-0001",
    serialNumber: "DL-R450-WEB01",
    loggedUser: "svc-web",
    macAddress: "00:1B:44:11:3A:B7",
    os: "Ubuntu Server 24.04 LTS",
    cpuModel: "Intel Xeon Silver 4310",
    cpuCores: 24,
    ramGb: 64,
    disks: [
      { label: "RAID-1 System", sizeGb: 480, type: "SSD" },
      { label: "RAID-5 Data", sizeGb: 2048, type: "SSD" }
    ],
    peripherals: [
      { id: "per-web-01", type: "Monitor", brand: "Dell", assetTag: "PAT-1002" },
      { id: "per-web-02", type: "Teclado", brand: "Logitech", assetTag: "PAT-9981" }
    ],
    changeHistory: [
      {
        id: "chg-web-01",
        detectedAt: "2026-05-02T14:33:00.000Z",
        change: "RAM atualizada",
        oldValue: "32 GB",
        newValue: "64 GB"
      }
    ],
    software: ["nginx", "nodejs", "docker", "zabbix-agent2"],
    lastInventoryAt: "2026-05-05T08:05:00.000Z"
  },
  {
    hostId: "srv-db-01",
    manufacturer: "HPE",
    model: "ProLiant DL380 Gen10",
    assetTag: "ATV-SRV-0002",
    serialNumber: "HPE-DL380-DB01",
    loggedUser: "postgres",
    macAddress: "00:25:90:6B:12:01",
    os: "Rocky Linux 9.4",
    cpuModel: "Intel Xeon Gold 6248R",
    cpuCores: 48,
    ramGb: 256,
    disks: [
      { label: "RAID-10 Database", sizeGb: 4096, type: "NVMe" },
      { label: "Backup Volume", sizeGb: 8192, type: "HDD" }
    ],
    peripherals: [
      { id: "per-db-01", type: "Monitor", brand: "LG", assetTag: "PAT-1109" },
      { id: "per-db-02", type: "Dockstation", brand: "HPE", assetTag: "PAT-3331" }
    ],
    changeHistory: [
      {
        id: "chg-db-01",
        detectedAt: "2026-05-03T09:12:00.000Z",
        change: "Volume de backup adicionado",
        oldValue: "Sem volume dedicado",
        newValue: "Backup Volume 8192 GB HDD"
      }
    ],
    software: ["postgresql", "pgbackrest", "zabbix-agent2", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:11:00.000Z"
  },
  {
    hostId: "fw-edge-01",
    manufacturer: "Fortinet",
    model: "FortiGate 100F",
    assetTag: "ATV-NET-0001",
    serialNumber: "FG100F-EDGE01",
    loggedUser: "admin",
    macAddress: "70:4C:A5:2D:18:90",
    os: "FortiOS 7.4",
    cpuModel: "SoC4",
    cpuCores: 8,
    ramGb: 8,
    disks: [{ label: "Internal Storage", sizeGb: 128, type: "SSD" }],
    peripherals: [
      { id: "per-fw-01", type: "Scanner", brand: "Zebra", assetTag: "PAT-7012" }
    ],
    changeHistory: [
      {
        id: "chg-fw-01",
        detectedAt: "2026-05-01T16:48:00.000Z",
        change: "Firmware atualizado",
        oldValue: "FortiOS 7.2",
        newValue: "FortiOS 7.4"
      }
    ],
    software: ["ips", "vpn", "sd-wan", "zabbix-snmp"],
    lastInventoryAt: "2026-05-05T07:52:00.000Z"
  },
  {
    hostId: "ws-fin-07",
    manufacturer: "Lenovo",
    model: "ThinkCentre M70q",
    assetTag: "ATV-WS-0007",
    serialNumber: "LEN-M70Q-FIN07",
    loggedUser: "financeiro07",
    macAddress: "A8:7E:EA:45:91:07",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-12400T",
    cpuCores: 12,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-fin-01", type: "Monitor", brand: "LG", assetTag: "PAT-1002" },
      { id: "per-fin-02", type: "Mouse", brand: "Logitech", assetTag: "PAT-2011" },
      { id: "per-fin-03", type: "Teclado", brand: "Redragon", assetTag: "PAT-9981" },
      { id: "per-fin-04", type: "Headset", brand: "Jabra", assetTag: "PAT-4408" }
    ],
    changeHistory: [
      {
        id: "chg-fin-01",
        detectedAt: "2026-05-04T10:20:00.000Z",
        change: "Novo headset conectado",
        oldValue: "Nenhum headset",
        newValue: "Jabra PAT-4408"
      }
    ],
    software: ["Microsoft 365", "Power BI Desktop", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-04T20:18:00.000Z"
  },
  {
    hostId: "srv-app-02",
    manufacturer: "Lenovo",
    model: "ThinkSystem SR650 V3",
    assetTag: "ATV-SRV-0003",
    serialNumber: "LEN-SR650-APP02",
    loggedUser: "svc-app",
    macAddress: "3C:EC:EF:91:20:42",
    os: "Debian 12",
    cpuModel: "Intel Xeon Silver 4410Y",
    cpuCores: 24,
    ramGb: 128,
    disks: [
      { label: "System Volume", sizeGb: 960, type: "SSD" },
      { label: "Application Data", sizeGb: 2048, type: "NVMe" }
    ],
    peripherals: [
      { id: "per-app-01", type: "Monitor", brand: "AOC", assetTag: "PAT-3102" },
      { id: "per-app-02", type: "Teclado", brand: "Dell", assetTag: "PAT-3103" }
    ],
    changeHistory: [
      {
        id: "chg-app-01",
        detectedAt: "2026-05-05T08:19:00.000Z",
        change: "Aplicacao migrada",
        oldValue: "Tomcat 9",
        newValue: "Tomcat 10"
      }
    ],
    software: ["java", "tomcat", "redis-tools", "zabbix-agent2", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:19:00.000Z"
  },
  {
    hostId: "srv-bkp-01",
    manufacturer: "Dell",
    model: "PowerEdge R750",
    assetTag: "ATV-SRV-0004",
    serialNumber: "DL-R750-BKP01",
    loggedUser: "backup-operator",
    macAddress: "00:1B:44:82:5D:60",
    os: "Ubuntu Server 22.04 LTS",
    cpuModel: "Intel Xeon Gold 6338",
    cpuCores: 64,
    ramGb: 256,
    disks: [
      { label: "OS Mirror", sizeGb: 960, type: "SSD" },
      { label: "Backup Pool", sizeGb: 16384, type: "HDD" }
    ],
    peripherals: [
      { id: "per-bkp-01", type: "Monitor", brand: "Dell", assetTag: "PAT-4101" },
      { id: "per-bkp-02", type: "Dockstation", brand: "Dell", assetTag: "PAT-4102" }
    ],
    changeHistory: [
      {
        id: "chg-bkp-01",
        detectedAt: "2026-05-05T07:40:00.000Z",
        change: "Disco substituido",
        oldValue: "Backup Pool 8192 GB",
        newValue: "Backup Pool 16384 GB"
      }
    ],
    software: ["veeam-agent", "restic", "rclone", "zabbix-agent2", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:23:00.000Z"
  },
  {
    hostId: "ws-adm-03",
    manufacturer: "Dell",
    model: "OptiPlex 7010",
    assetTag: "ATV-WS-0003",
    serialNumber: "DL-OP7010-ADM03",
    loggedUser: "adm03",
    macAddress: "D8:BB:C1:11:45:33",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-13500",
    cpuCores: 14,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-adm-01", type: "Monitor", brand: "Samsung", assetTag: "PAT-5201" },
      { id: "per-adm-02", type: "Mouse", brand: "Microsoft", assetTag: "PAT-5202" },
      { id: "per-adm-03", type: "Teclado", brand: "Microsoft", assetTag: "PAT-5203" },
      { id: "per-adm-04", type: "Webcam", brand: "Logitech", assetTag: "PAT-5204" }
    ],
    changeHistory: [
      {
        id: "chg-adm-01",
        detectedAt: "2026-05-04T15:02:00.000Z",
        change: "Webcam adicionada",
        oldValue: "Sem webcam",
        newValue: "Logitech PAT-5204"
      }
    ],
    software: ["Microsoft 365", "Teams", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-05T07:58:00.000Z"
  },
  {
    hostId: "ws-rh-12",
    manufacturer: "HP",
    model: "EliteDesk 800 G9",
    assetTag: "ATV-WS-0012",
    serialNumber: "HP-ED800-RH12",
    loggedUser: "rh12",
    macAddress: "F4:39:09:AF:44:12",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i7-12700",
    cpuCores: 20,
    ramGb: 32,
    disks: [{ label: "C:", sizeGb: 1024, type: "NVMe" }],
    peripherals: [
      { id: "per-rh-01", type: "Monitor", brand: "HP", assetTag: "PAT-6301" },
      { id: "per-rh-02", type: "Headset", brand: "Jabra", assetTag: "PAT-6302" },
      { id: "per-rh-03", type: "Scanner", brand: "Canon", assetTag: "PAT-6303" }
    ],
    changeHistory: [
      {
        id: "chg-rh-01",
        detectedAt: "2026-05-02T11:18:00.000Z",
        change: "Scanner vinculado",
        oldValue: "Sem scanner",
        newValue: "Canon PAT-6303"
      }
    ],
    software: ["Microsoft 365", "Chrome", "Adobe Reader", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:02:00.000Z"
  },
  {
    hostId: "nb-diretoria-01",
    manufacturer: "Apple",
    model: "MacBook Pro 14",
    assetTag: "ATV-NB-0001",
    serialNumber: "APL-MBP14-DIR01",
    loggedUser: "diretoria01",
    macAddress: "E4:CE:8F:73:20:15",
    os: "macOS 15.4",
    cpuModel: "Apple M3 Pro",
    cpuCores: 12,
    ramGb: 36,
    disks: [{ label: "Macintosh HD", sizeGb: 1024, type: "SSD" }],
    peripherals: [
      { id: "per-dir-01", type: "Notebook", brand: "Apple", assetTag: "PAT-7001" },
      { id: "per-dir-02", type: "Dockstation", brand: "CalDigit", assetTag: "PAT-7002" },
      { id: "per-dir-03", type: "Monitor", brand: "LG", assetTag: "PAT-7003" }
    ],
    changeHistory: [
      {
        id: "chg-dir-01",
        detectedAt: "2026-05-01T13:24:00.000Z",
        change: "Dockstation alterada",
        oldValue: "Dell WD19",
        newValue: "CalDigit PAT-7002"
      }
    ],
    software: ["Microsoft 365", "Slack", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-04T18:44:00.000Z"
  },
  {
    hostId: "prd-print-01",
    manufacturer: "Brother",
    model: "MFC-L8900CDW",
    assetTag: "ATV-PRD-0001",
    serialNumber: "BR-MFC-PRD01",
    loggedUser: "spooler",
    macAddress: "30:05:5C:9A:81:18",
    os: "Embedded Linux",
    cpuModel: "ARM Cortex-A9",
    cpuCores: 4,
    ramGb: 2,
    disks: [{ label: "Internal Flash", sizeGb: 16, type: "Flash" }],
    peripherals: [
      { id: "per-prd-01", type: "Impressora", brand: "Brother", assetTag: "PAT-8101" },
      { id: "per-prd-02", type: "Scanner", brand: "Brother", assetTag: "PAT-8102" }
    ],
    changeHistory: [
      {
        id: "chg-prd-01",
        detectedAt: "2026-05-03T08:55:00.000Z",
        change: "Modulo scanner detectado",
        oldValue: "Impressora simples",
        newValue: "Multifuncional com scanner"
      }
    ],
    software: ["print-service", "snmp-agent"],
    lastInventoryAt: "2026-05-05T07:49:00.000Z"
  },
  {
    hostId: "ws-caixa-01",
    manufacturer: "Bematech",
    model: "RC-8400",
    assetTag: "ATV-PDV-0001",
    serialNumber: "BMT-RC8400-CX01",
    loggedUser: "caixa01",
    macAddress: "AC:1F:6B:90:11:01",
    os: "Windows 11 IoT Enterprise",
    cpuModel: "Intel Core i3-12100T",
    cpuCores: 8,
    ramGb: 8,
    disks: [{ label: "C:", sizeGb: 256, type: "SSD" }],
    peripherals: [
      { id: "per-cx01-01", type: "Monitor", brand: "Bematech", assetTag: "PAT-9001" },
      { id: "per-cx01-02", type: "Scanner", brand: "Zebra", assetTag: "PAT-9002" },
      { id: "per-cx01-03", type: "Impressora", brand: "Epson", assetTag: "PAT-9003" }
    ],
    changeHistory: [
      {
        id: "chg-cx01-01",
        detectedAt: "2026-05-04T12:10:00.000Z",
        change: "Leitor de codigo substituido",
        oldValue: "Honeywell PAT-8801",
        newValue: "Zebra PAT-9002"
      }
    ],
    software: ["pdv-client", "tef", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:26:00.000Z"
  },
  {
    hostId: "ws-caixa-02",
    manufacturer: "Bematech",
    model: "RC-8400",
    assetTag: "ATV-PDV-0002",
    serialNumber: "BMT-RC8400-CX02",
    loggedUser: "caixa02",
    macAddress: "AC:1F:6B:90:11:02",
    os: "Windows 11 IoT Enterprise",
    cpuModel: "Intel Core i3-12100T",
    cpuCores: 8,
    ramGb: 8,
    disks: [{ label: "C:", sizeGb: 256, type: "SSD" }],
    peripherals: [
      { id: "per-cx02-01", type: "Monitor", brand: "AOC", assetTag: "PAT-9011" },
      { id: "per-cx02-02", type: "Scanner", brand: "Zebra", assetTag: "PAT-9012" },
      { id: "per-cx02-03", type: "Impressora", brand: "Epson", assetTag: "PAT-9013" }
    ],
    changeHistory: [
      {
        id: "chg-cx02-01",
        detectedAt: "2026-05-03T17:42:00.000Z",
        change: "Memoria conferida",
        oldValue: "4 GB",
        newValue: "8 GB"
      }
    ],
    software: ["pdv-client", "tef", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:27:00.000Z"
  },
  {
    hostId: "ws-caixa-03",
    manufacturer: "Bematech",
    model: "RC-8300",
    assetTag: "ATV-PDV-0003",
    serialNumber: "BMT-RC8300-CX03",
    loggedUser: "caixa03",
    macAddress: "AC:1F:6B:90:11:03",
    os: "Windows 10 IoT Enterprise",
    cpuModel: "Intel Core i3-10100T",
    cpuCores: 8,
    ramGb: 8,
    disks: [{ label: "C:", sizeGb: 256, type: "SSD" }],
    peripherals: [
      { id: "per-cx03-01", type: "Monitor", brand: "LG", assetTag: "PAT-9021" },
      { id: "per-cx03-02", type: "Scanner", brand: "Honeywell", assetTag: "PAT-9022" },
      { id: "per-cx03-03", type: "Impressora", brand: "Epson", assetTag: "PAT-9023" }
    ],
    changeHistory: [
      {
        id: "chg-cx03-01",
        detectedAt: "2026-05-05T10:59:00.000Z",
        change: "Host ficou indisponivel",
        oldValue: "Online",
        newValue: "Sem telemetria"
      }
    ],
    software: ["pdv-client", "tef", "ocs-agent"],
    lastInventoryAt: "2026-05-05T09:12:00.000Z"
  },
  {
    hostId: "ws-aud-04",
    manufacturer: "Dell",
    model: "OptiPlex 7000",
    assetTag: "ATV-WS-0004",
    serialNumber: "DL-OP7000-AUD04",
    loggedUser: "auditoria04",
    macAddress: "D8:BB:C1:70:04:44",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-12500",
    cpuCores: 12,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-aud-01", type: "Monitor", brand: "Dell", assetTag: "PAT-5401" },
      { id: "per-aud-02", type: "Mouse", brand: "Dell", assetTag: "PAT-5402" },
      { id: "per-aud-03", type: "Teclado", brand: "Dell", assetTag: "PAT-5403" }
    ],
    changeHistory: [
      {
        id: "chg-aud-01",
        detectedAt: "2026-05-02T09:31:00.000Z",
        change: "Disco atualizado",
        oldValue: "256 GB SSD",
        newValue: "512 GB NVMe"
      }
    ],
    software: ["Microsoft 365", "Power BI Desktop", "SAP GUI", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:13:00.000Z"
  },
  {
    hostId: "nb-vendas-05",
    manufacturer: "Lenovo",
    model: "ThinkPad T14 Gen 5",
    assetTag: "ATV-NB-0005",
    serialNumber: "LEN-T14-VND05",
    loggedUser: "vendas05",
    macAddress: "C8:5B:76:21:40:05",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core Ultra 5 125U",
    cpuCores: 14,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-vnd-01", type: "Notebook", brand: "Lenovo", assetTag: "PAT-7605" },
      { id: "per-vnd-02", type: "Headset", brand: "Poly", assetTag: "PAT-7606" }
    ],
    changeHistory: [
      {
        id: "chg-vnd-01",
        detectedAt: "2026-05-05T08:06:00.000Z",
        change: "Headset adicionado",
        oldValue: "Sem headset",
        newValue: "Poly PAT-7606"
      }
    ],
    software: ["Microsoft 365", "Teams", "CRM Web", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:29:00.000Z"
  },
  {
    hostId: "nb-comercial-02",
    manufacturer: "HP",
    model: "EliteBook 840 G10",
    assetTag: "ATV-NB-0002",
    serialNumber: "HP-EB840-COM02",
    loggedUser: "comercial02",
    macAddress: "44:1E:A1:72:80:02",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i7-1365U",
    cpuCores: 12,
    ramGb: 32,
    disks: [{ label: "C:", sizeGb: 1024, type: "NVMe" }],
    peripherals: [
      { id: "per-com-01", type: "Notebook", brand: "HP", assetTag: "PAT-7702" },
      { id: "per-com-02", type: "Dockstation", brand: "HP", assetTag: "PAT-7703" },
      { id: "per-com-03", type: "Monitor", brand: "Samsung", assetTag: "PAT-7704" }
    ],
    changeHistory: [
      {
        id: "chg-com-01",
        detectedAt: "2026-05-05T11:05:00.000Z",
        change: "Consumo elevado detectado",
        oldValue: "CPU media 45%",
        newValue: "CPU media 78%"
      }
    ],
    software: ["Microsoft 365", "Teams", "CRM Desktop", "Power BI Desktop", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:31:00.000Z"
  },
  {
    hostId: "srv-files-01",
    manufacturer: "Dell",
    model: "PowerEdge R550",
    assetTag: "ATV-SRV-0005",
    serialNumber: "DL-R550-FILE01",
    loggedUser: "svc-files",
    macAddress: "00:1B:44:55:20:75",
    os: "Windows Server 2022",
    cpuModel: "Intel Xeon Silver 4314",
    cpuCores: 32,
    ramGb: 128,
    disks: [
      { label: "OS Mirror", sizeGb: 480, type: "SSD" },
      { label: "File Share", sizeGb: 12288, type: "HDD" }
    ],
    peripherals: [
      { id: "per-file-01", type: "Monitor", brand: "Dell", assetTag: "PAT-4301" },
      { id: "per-file-02", type: "Teclado", brand: "Dell", assetTag: "PAT-4302" }
    ],
    changeHistory: [
      {
        id: "chg-file-01",
        detectedAt: "2026-05-04T19:15:00.000Z",
        change: "Compartilhamento expandido",
        oldValue: "8 TB",
        newValue: "12 TB"
      }
    ],
    software: ["File Server", "Windows Defender", "zabbix-agent2", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:30:00.000Z"
  },
  {
    hostId: "srv-auth-01",
    manufacturer: "HPE",
    model: "ProLiant DL360 Gen10",
    assetTag: "ATV-SRV-0006",
    serialNumber: "HPE-DL360-AUTH01",
    loggedUser: "svc-ad",
    macAddress: "00:25:90:12:70:12",
    os: "Windows Server 2022",
    cpuModel: "Intel Xeon Silver 4214R",
    cpuCores: 24,
    ramGb: 64,
    disks: [
      { label: "OS Mirror", sizeGb: 480, type: "SSD" },
      { label: "Directory Logs", sizeGb: 1024, type: "SSD" }
    ],
    peripherals: [
      { id: "per-auth-01", type: "Monitor", brand: "HP", assetTag: "PAT-4401" }
    ],
    changeHistory: [
      {
        id: "chg-auth-01",
        detectedAt: "2026-05-01T22:12:00.000Z",
        change: "Patch de seguranca aplicado",
        oldValue: "KB5039211 pendente",
        newValue: "KB5039211 instalado"
      }
    ],
    software: ["Active Directory", "DNS Server", "DHCP Server", "zabbix-agent2", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:17:00.000Z"
  },
  {
    hostId: "sw-core-01",
    manufacturer: "Cisco",
    model: "Catalyst 9500",
    assetTag: "ATV-NET-0002",
    serialNumber: "CSC-C9500-CORE01",
    loggedUser: "netops",
    macAddress: "00:AA:6E:CC:95:01",
    os: "IOS XE 17.12",
    cpuModel: "Cisco UADP 3.0",
    cpuCores: 8,
    ramGb: 16,
    disks: [{ label: "Flash", sizeGb: 32, type: "Flash" }],
    peripherals: [
      { id: "per-sw-01", type: "Outro", brand: "Cisco SFP+", assetTag: "PAT-9501" },
      { id: "per-sw-02", type: "Outro", brand: "Cisco StackWise", assetTag: "PAT-9502" }
    ],
    changeHistory: [
      {
        id: "chg-sw-01",
        detectedAt: "2026-05-02T02:44:00.000Z",
        change: "Modulo SFP detectado",
        oldValue: "Porta Te1/0/48 vazia",
        newValue: "Cisco SFP+ PAT-9501"
      }
    ],
    software: ["snmp-agent", "netflow", "syslog-forwarder"],
    lastInventoryAt: "2026-05-05T08:22:00.000Z"
  },
  {
    hostId: "cam-nvr-01",
    manufacturer: "Hikvision",
    model: "DS-9632NI-I8",
    assetTag: "ATV-SEC-0001",
    serialNumber: "HK-NVR-9632-01",
    loggedUser: "security",
    macAddress: "9C:A3:AA:40:20:10",
    os: "Embedded Linux",
    cpuModel: "ARM Cortex-A53",
    cpuCores: 8,
    ramGb: 8,
    disks: [
      { label: "Recording Pool A", sizeGb: 8192, type: "HDD" },
      { label: "Recording Pool B", sizeGb: 8192, type: "HDD" }
    ],
    peripherals: [
      { id: "per-nvr-01", type: "Outro", brand: "Hikvision Camera Pack", assetTag: "PAT-8801" }
    ],
    changeHistory: [
      {
        id: "chg-nvr-01",
        detectedAt: "2026-05-05T11:20:00.000Z",
        change: "Disco de gravacao quase cheio",
        oldValue: "89%",
        newValue: "94%"
      }
    ],
    software: ["nvr-service", "snmp-agent", "rtsp-service"],
    lastInventoryAt: "2026-05-05T08:21:00.000Z"
  },
  {
    hostId: "kiosk-rec-01",
    manufacturer: "Positivo",
    model: "Kiosk Fit",
    assetTag: "ATV-KSK-0001",
    serialNumber: "POS-KIOSK-REC01",
    loggedUser: "recepcao",
    macAddress: "E0:D5:5E:10:90:01",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-1135G7",
    cpuCores: 8,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "SSD" }],
    peripherals: [
      { id: "per-ksk-01", type: "Monitor", brand: "Positivo Touch", assetTag: "PAT-9701" },
      { id: "per-ksk-02", type: "Webcam", brand: "Logitech", assetTag: "PAT-9702" },
      { id: "per-ksk-03", type: "Scanner", brand: "Zebra", assetTag: "PAT-9703" }
    ],
    changeHistory: [
      {
        id: "chg-ksk-01",
        detectedAt: "2026-05-04T08:48:00.000Z",
        change: "Webcam substituida",
        oldValue: "Microsoft LifeCam",
        newValue: "Logitech PAT-9702"
      }
    ],
    software: ["visitor-kiosk", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-05T08:28:00.000Z"
  },
  {
    hostId: "srv-erp-01",
    manufacturer: "Dell",
    model: "PowerEdge R650",
    assetTag: "ATV-SRV-0007",
    serialNumber: "DL-R650-ERP01",
    loggedUser: "svc-erp",
    macAddress: "00:1B:44:91:33:01",
    os: "Windows Server 2022",
    cpuModel: "Intel Xeon Silver 4316",
    cpuCores: 40,
    ramGb: 128,
    disks: [
      { label: "OS Mirror", sizeGb: 960, type: "SSD" },
      { label: "ERP Data", sizeGb: 4096, type: "NVMe" }
    ],
    peripherals: [{ id: "per-erp-01", type: "Monitor", brand: "Dell", assetTag: "PAT-4501" }],
    changeHistory: [
      {
        id: "chg-erp-01",
        detectedAt: "2026-05-06T08:31:00.000Z",
        change: "Servico ERP atualizado",
        oldValue: "ERP 2025.4",
        newValue: "ERP 2026.1"
      }
    ],
    software: ["ERP Server", "SQL Server Client", "IIS", "zabbix-agent2", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:31:00.000Z"
  },
  {
    hostId: "srv-vmhost-02",
    manufacturer: "HPE",
    model: "ProLiant DL385 Gen11",
    assetTag: "ATV-SRV-0008",
    serialNumber: "HPE-DL385-VM02",
    loggedUser: "hypervisor",
    macAddress: "00:25:90:31:34:02",
    os: "VMware ESXi 8.0",
    cpuModel: "AMD EPYC 9354",
    cpuCores: 64,
    ramGb: 512,
    disks: [
      { label: "Boot", sizeGb: 480, type: "SSD" },
      { label: "Datastore-02", sizeGb: 8192, type: "NVMe" }
    ],
    peripherals: [{ id: "per-vm02-01", type: "Outro", brand: "HPE iLO", assetTag: "PAT-4601" }],
    changeHistory: [
      {
        id: "chg-vm02-01",
        detectedAt: "2026-05-06T07:52:00.000Z",
        change: "Novo datastore detectado",
        oldValue: "4096 GB",
        newValue: "8192 GB"
      }
    ],
    software: ["esxi", "vcenter-agent", "zabbix-agent2"],
    lastInventoryAt: "2026-05-06T08:20:00.000Z"
  },
  {
    hostId: "srv-mail-01",
    manufacturer: "Lenovo",
    model: "ThinkSystem SR630 V3",
    assetTag: "ATV-SRV-0009",
    serialNumber: "LEN-SR630-MAIL01",
    loggedUser: "svc-mail",
    macAddress: "3C:EC:EF:91:44:01",
    os: "Ubuntu Server 24.04 LTS",
    cpuModel: "Intel Xeon Silver 4410T",
    cpuCores: 20,
    ramGb: 64,
    disks: [
      { label: "System Volume", sizeGb: 480, type: "SSD" },
      { label: "Mail Queue", sizeGb: 2048, type: "SSD" }
    ],
    peripherals: [{ id: "per-mail-01", type: "Monitor", brand: "Lenovo", assetTag: "PAT-4701" }],
    changeHistory: [
      {
        id: "chg-mail-01",
        detectedAt: "2026-05-05T18:12:00.000Z",
        change: "Fila de email normalizada",
        oldValue: "Fila acima de 12 GB",
        newValue: "Fila abaixo de 2 GB"
      }
    ],
    software: ["postfix", "rspamd", "dovecot", "zabbix-agent2", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:14:00.000Z"
  },
  {
    hostId: "srv-mon-01",
    manufacturer: "Dell",
    model: "PowerEdge R450",
    assetTag: "ATV-SRV-0010",
    serialNumber: "DL-R450-MON01",
    loggedUser: "svc-monitoring",
    macAddress: "00:1B:44:91:50:01",
    os: "Debian 12",
    cpuModel: "Intel Xeon Silver 4310",
    cpuCores: 24,
    ramGb: 96,
    disks: [
      { label: "System", sizeGb: 480, type: "SSD" },
      { label: "Monitoring Data", sizeGb: 4096, type: "HDD" }
    ],
    peripherals: [{ id: "per-mon-01", type: "Monitor", brand: "AOC", assetTag: "PAT-4801" }],
    changeHistory: [
      {
        id: "chg-mon-01",
        detectedAt: "2026-05-06T09:10:00.000Z",
        change: "Memoria acima do esperado",
        oldValue: "Uso medio 63%",
        newValue: "Uso medio 86%"
      }
    ],
    software: ["zabbix-server", "grafana", "postgresql", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:19:00.000Z"
  },
  {
    hostId: "ws-contab-01",
    manufacturer: "Dell",
    model: "OptiPlex 7010",
    assetTag: "ATV-WS-0015",
    serialNumber: "DL-OP7010-CONT01",
    loggedUser: "contab01",
    macAddress: "D8:BB:C1:70:51:01",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-13500",
    cpuCores: 14,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-cont01-01", type: "Monitor", brand: "Dell", assetTag: "PAT-5511" },
      { id: "per-cont01-02", type: "Mouse", brand: "Dell", assetTag: "PAT-5512" },
      { id: "per-cont01-03", type: "Teclado", brand: "Dell", assetTag: "PAT-5513" }
    ],
    changeHistory: [],
    software: ["Microsoft 365", "Domínio Contabil", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:02:00.000Z"
  },
  {
    hostId: "ws-contab-02",
    manufacturer: "HP",
    model: "ProDesk 400 G9",
    assetTag: "ATV-WS-0016",
    serialNumber: "HP-PD400-CONT02",
    loggedUser: "contab02",
    macAddress: "F4:39:09:70:52:02",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-12500",
    cpuCores: 12,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-cont02-01", type: "Monitor", brand: "HP", assetTag: "PAT-5521" },
      { id: "per-cont02-02", type: "Headset", brand: "Jabra", assetTag: "PAT-5522" }
    ],
    changeHistory: [],
    software: ["Microsoft 365", "Domínio Contabil", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:04:00.000Z"
  },
  {
    hostId: "ws-juridico-01",
    manufacturer: "Lenovo",
    model: "ThinkCentre M80q",
    assetTag: "ATV-WS-0017",
    serialNumber: "LEN-M80Q-JUR01",
    loggedUser: "juridico01",
    macAddress: "A8:7E:EA:45:41:01",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-12400T",
    cpuCores: 12,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-jur01-01", type: "Monitor", brand: "Samsung", assetTag: "PAT-5611" },
      { id: "per-jur01-02", type: "Webcam", brand: "Logitech", assetTag: "PAT-5612" }
    ],
    changeHistory: [],
    software: ["Microsoft 365", "PJe Office", "Adobe Reader", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:06:00.000Z"
  },
  {
    hostId: "ws-compras-04",
    manufacturer: "Dell",
    model: "OptiPlex 7000",
    assetTag: "ATV-WS-0018",
    serialNumber: "DL-OP7000-COMP04",
    loggedUser: "compras04",
    macAddress: "D8:BB:C1:70:64:04",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-12500",
    cpuCores: 12,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "NVMe" }],
    peripherals: [
      { id: "per-comp04-01", type: "Monitor", brand: "AOC", assetTag: "PAT-5641" },
      { id: "per-comp04-02", type: "Mouse", brand: "Logitech", assetTag: "PAT-5642" }
    ],
    changeHistory: [],
    software: ["Microsoft 365", "ERP Client", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:08:00.000Z"
  },
  {
    hostId: "ws-logistica-06",
    manufacturer: "HP",
    model: "EliteDesk 800 G8",
    assetTag: "ATV-WS-0019",
    serialNumber: "HP-ED800-LOG06",
    loggedUser: "logistica06",
    macAddress: "F4:39:09:90:46:06",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i5-11500",
    cpuCores: 12,
    ramGb: 16,
    disks: [{ label: "C:", sizeGb: 512, type: "SSD" }],
    peripherals: [
      { id: "per-log06-01", type: "Monitor", brand: "LG", assetTag: "PAT-5906" },
      { id: "per-log06-02", type: "Scanner", brand: "Zebra", assetTag: "PAT-5907" }
    ],
    changeHistory: [
      {
        id: "chg-log06-01",
        detectedAt: "2026-05-06T10:20:00.000Z",
        change: "Host ficou indisponivel",
        oldValue: "Online",
        newValue: "Sem telemetria"
      }
    ],
    software: ["WMS Client", "Chrome", "ocs-agent"],
    lastInventoryAt: "2026-05-06T09:58:00.000Z"
  },
  {
    hostId: "ws-suporte-02",
    manufacturer: "Lenovo",
    model: "ThinkStation P3 Tiny",
    assetTag: "ATV-WS-0020",
    serialNumber: "LEN-P3-SUP02",
    loggedUser: "suporte02",
    macAddress: "A8:7E:EA:44:32:02",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core i7-13700T",
    cpuCores: 24,
    ramGb: 32,
    disks: [{ label: "C:", sizeGb: 1024, type: "NVMe" }],
    peripherals: [
      { id: "per-sup02-01", type: "Monitor", brand: "Dell", assetTag: "PAT-5409" },
      { id: "per-sup02-02", type: "Headset", brand: "Jabra", assetTag: "PAT-5410" }
    ],
    changeHistory: [],
    software: ["Microsoft 365", "AnyDesk", "PuTTY", "Wireshark", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:10:00.000Z"
  },
  {
    hostId: "nb-gerencia-03",
    manufacturer: "Dell",
    model: "Latitude 7450",
    assetTag: "ATV-NB-0008",
    serialNumber: "DL-LAT7450-GER03",
    loggedUser: "gerencia03",
    macAddress: "D8:BB:C1:88:73:03",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core Ultra 7 165U",
    cpuCores: 14,
    ramGb: 32,
    disks: [{ label: "C:", sizeGb: 1024, type: "NVMe" }],
    peripherals: [
      { id: "per-ger03-01", type: "Notebook", brand: "Dell", assetTag: "PAT-7803" },
      { id: "per-ger03-02", type: "Dockstation", brand: "Dell", assetTag: "PAT-7804" }
    ],
    changeHistory: [],
    software: ["Microsoft 365", "Teams", "Power BI Desktop", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:12:00.000Z"
  },
  {
    hostId: "nb-ti-01",
    manufacturer: "Lenovo",
    model: "ThinkPad P14s Gen 5",
    assetTag: "ATV-NB-0009",
    serialNumber: "LEN-P14S-TI01",
    loggedUser: "ti01",
    macAddress: "C8:5B:76:21:81:01",
    os: "Windows 11 Pro",
    cpuModel: "Intel Core Ultra 7 155H",
    cpuCores: 22,
    ramGb: 32,
    disks: [{ label: "C:", sizeGb: 1024, type: "NVMe" }],
    peripherals: [
      { id: "per-ti01-01", type: "Notebook", brand: "Lenovo", assetTag: "PAT-7901" },
      { id: "per-ti01-02", type: "Dockstation", brand: "Lenovo", assetTag: "PAT-7902" }
    ],
    changeHistory: [],
    software: ["VS Code", "Node.js", "Docker Desktop", "PowerShell", "ocs-agent"],
    lastInventoryAt: "2026-05-06T08:15:00.000Z"
  },
  {
    hostId: "prd-print-02",
    manufacturer: "HP",
    model: "Color LaserJet Enterprise MFP M480",
    assetTag: "ATV-PRD-0002",
    serialNumber: "HP-M480-PRINT02",
    loggedUser: "spooler",
    macAddress: "F8:BC:12:10:03:19",
    os: "Embedded Linux",
    cpuModel: "ARM Cortex-A9",
    cpuCores: 4,
    ramGb: 2,
    disks: [{ label: "Internal Flash", sizeGb: 16, type: "Flash" }],
    peripherals: [{ id: "per-prd02-01", type: "Impressora", brand: "HP", assetTag: "PAT-8121" }],
    changeHistory: [],
    software: ["print-service", "snmp-agent"],
    lastInventoryAt: "2026-05-06T08:16:00.000Z"
  }
];
