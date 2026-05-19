export const zabbixHosts = [
  {
    id: "srv-web-01",
    name: "SRV-WEB-01",
    ip: "10.10.1.21",
    status: "online",
    uptimeHours: 742,
    metrics: {
      cpu: 34,
      ram: 58,
      disk: 63,
      networkInMbps: 42,
      networkOutMbps: 18
    },
    history: [
      { time: "08:00", cpu: 27, ram: 54, disk: 62 },
      { time: "09:00", cpu: 32, ram: 56, disk: 62 },
      { time: "10:00", cpu: 37, ram: 58, disk: 63 },
      { time: "11:00", cpu: 34, ram: 58, disk: 63 }
    ]
  },
  {
    id: "srv-db-01",
    name: "SRV-DB-01",
    ip: "10.10.1.30",
    status: "problem",
    uptimeHours: 1190,
    metrics: {
      cpu: 88,
      ram: 91,
      disk: 76,
      networkInMbps: 130,
      networkOutMbps: 74
    },
    history: [
      { time: "08:00", cpu: 62, ram: 80, disk: 74 },
      { time: "09:00", cpu: 74, ram: 85, disk: 75 },
      { time: "10:00", cpu: 91, ram: 92, disk: 76 },
      { time: "11:00", cpu: 88, ram: 91, disk: 76 }
    ]
  },
  {
    id: "fw-edge-01",
    name: "FW-EDGE-01",
    ip: "10.10.0.1",
    status: "online",
    uptimeHours: 2104,
    metrics: {
      cpu: 22,
      ram: 41,
      disk: 36,
      networkInMbps: 220,
      networkOutMbps: 194
    },
    history: [
      { time: "08:00", cpu: 18, ram: 40, disk: 36 },
      { time: "09:00", cpu: 20, ram: 42, disk: 36 },
      { time: "10:00", cpu: 24, ram: 42, disk: 36 },
      { time: "11:00", cpu: 22, ram: 41, disk: 36 }
    ]
  },
  {
    id: "ws-fin-07",
    name: "WS-FIN-07",
    ip: "10.10.7.45",
    status: "offline",
    uptimeHours: 0,
    metrics: {
      cpu: 0,
      ram: 0,
      disk: 68,
      networkInMbps: 0,
      networkOutMbps: 0
    },
    history: [
      { time: "08:00", cpu: 24, ram: 51, disk: 68 },
      { time: "09:00", cpu: 0, ram: 0, disk: 68 },
      { time: "10:00", cpu: 0, ram: 0, disk: 68 },
      { time: "11:00", cpu: 0, ram: 0, disk: 68 }
    ]
  },
  {
    id: "srv-app-02",
    name: "SRV-APP-02",
    ip: "10.10.1.42",
    status: "online",
    uptimeHours: 528,
    metrics: {
      cpu: 46,
      ram: 64,
      disk: 55,
      networkInMbps: 68,
      networkOutMbps: 39
    },
    history: [
      { time: "08:00", cpu: 38, ram: 60, disk: 54 },
      { time: "09:00", cpu: 42, ram: 62, disk: 54 },
      { time: "10:00", cpu: 49, ram: 63, disk: 55 },
      { time: "11:00", cpu: 46, ram: 64, disk: 55 }
    ]
  },
  {
    id: "srv-bkp-01",
    name: "SRV-BKP-01",
    ip: "10.10.1.60",
    status: "problem",
    uptimeHours: 930,
    metrics: {
      cpu: 71,
      ram: 67,
      disk: 89,
      networkInMbps: 28,
      networkOutMbps: 145
    },
    history: [
      { time: "08:00", cpu: 52, ram: 61, disk: 84 },
      { time: "09:00", cpu: 65, ram: 65, disk: 86 },
      { time: "10:00", cpu: 76, ram: 68, disk: 88 },
      { time: "11:00", cpu: 71, ram: 67, disk: 89 }
    ]
  },
  {
    id: "ws-adm-03",
    name: "WS-ADM-03",
    ip: "10.10.5.33",
    status: "online",
    uptimeHours: 126,
    metrics: {
      cpu: 19,
      ram: 43,
      disk: 48,
      networkInMbps: 9,
      networkOutMbps: 6
    },
    history: [
      { time: "08:00", cpu: 16, ram: 41, disk: 47 },
      { time: "09:00", cpu: 22, ram: 44, disk: 48 },
      { time: "10:00", cpu: 18, ram: 42, disk: 48 },
      { time: "11:00", cpu: 19, ram: 43, disk: 48 }
    ]
  },
  {
    id: "ws-rh-12",
    name: "WS-RH-12",
    ip: "10.10.6.72",
    status: "online",
    uptimeHours: 84,
    metrics: {
      cpu: 27,
      ram: 51,
      disk: 61,
      networkInMbps: 12,
      networkOutMbps: 8
    },
    history: [
      { time: "08:00", cpu: 21, ram: 47, disk: 60 },
      { time: "09:00", cpu: 28, ram: 50, disk: 60 },
      { time: "10:00", cpu: 31, ram: 52, disk: 61 },
      { time: "11:00", cpu: 27, ram: 51, disk: 61 }
    ]
  },
  {
    id: "nb-diretoria-01",
    name: "NB-DIRETORIA-01",
    ip: "10.10.8.15",
    status: "offline",
    uptimeHours: 0,
    metrics: {
      cpu: 0,
      ram: 0,
      disk: 72,
      networkInMbps: 0,
      networkOutMbps: 0
    },
    history: [
      { time: "08:00", cpu: 33, ram: 62, disk: 72 },
      { time: "09:00", cpu: 29, ram: 59, disk: 72 },
      { time: "10:00", cpu: 0, ram: 0, disk: 72 },
      { time: "11:00", cpu: 0, ram: 0, disk: 72 }
    ]
  },
  {
    id: "prd-print-01",
    name: "PRD-PRINT-01",
    ip: "10.10.3.18",
    status: "online",
    uptimeHours: 386,
    metrics: {
      cpu: 11,
      ram: 36,
      disk: 44,
      networkInMbps: 5,
      networkOutMbps: 3
    },
    history: [
      { time: "08:00", cpu: 9, ram: 34, disk: 44 },
      { time: "09:00", cpu: 12, ram: 36, disk: 44 },
      { time: "10:00", cpu: 14, ram: 37, disk: 44 },
      { time: "11:00", cpu: 11, ram: 36, disk: 44 }
    ]
  },
  {
    id: "ws-caixa-01",
    name: "WS-CAIXA-01",
    ip: "10.10.9.21",
    status: "online",
    uptimeHours: 62,
    metrics: {
      cpu: 24,
      ram: 39,
      disk: 52,
      networkInMbps: 8,
      networkOutMbps: 4
    },
    history: [
      { time: "08:00", cpu: 21, ram: 37, disk: 52 },
      { time: "09:00", cpu: 23, ram: 38, disk: 52 },
      { time: "10:00", cpu: 29, ram: 40, disk: 52 },
      { time: "11:00", cpu: 24, ram: 39, disk: 52 }
    ]
  },
  {
    id: "ws-caixa-02",
    name: "WS-CAIXA-02",
    ip: "10.10.9.22",
    status: "online",
    uptimeHours: 58,
    metrics: {
      cpu: 31,
      ram: 46,
      disk: 49,
      networkInMbps: 10,
      networkOutMbps: 5
    },
    history: [
      { time: "08:00", cpu: 25, ram: 42, disk: 49 },
      { time: "09:00", cpu: 30, ram: 45, disk: 49 },
      { time: "10:00", cpu: 34, ram: 47, disk: 49 },
      { time: "11:00", cpu: 31, ram: 46, disk: 49 }
    ]
  },
  {
    id: "ws-caixa-03",
    name: "WS-CAIXA-03",
    ip: "10.10.9.23",
    status: "offline",
    uptimeHours: 0,
    metrics: {
      cpu: 0,
      ram: 0,
      disk: 57,
      networkInMbps: 0,
      networkOutMbps: 0
    },
    history: [
      { time: "08:00", cpu: 19, ram: 40, disk: 57 },
      { time: "09:00", cpu: 22, ram: 41, disk: 57 },
      { time: "10:00", cpu: 0, ram: 0, disk: 57 },
      { time: "11:00", cpu: 0, ram: 0, disk: 57 }
    ]
  },
  {
    id: "ws-aud-04",
    name: "WS-AUD-04",
    ip: "10.10.4.44",
    status: "online",
    uptimeHours: 139,
    metrics: {
      cpu: 18,
      ram: 44,
      disk: 66,
      networkInMbps: 7,
      networkOutMbps: 4
    },
    history: [
      { time: "08:00", cpu: 15, ram: 41, disk: 65 },
      { time: "09:00", cpu: 17, ram: 43, disk: 66 },
      { time: "10:00", cpu: 20, ram: 44, disk: 66 },
      { time: "11:00", cpu: 18, ram: 44, disk: 66 }
    ]
  },
  {
    id: "nb-vendas-05",
    name: "NB-VENDAS-05",
    ip: "10.10.8.55",
    status: "online",
    uptimeHours: 22,
    metrics: {
      cpu: 41,
      ram: 62,
      disk: 71,
      networkInMbps: 18,
      networkOutMbps: 11
    },
    history: [
      { time: "08:00", cpu: 35, ram: 58, disk: 70 },
      { time: "09:00", cpu: 43, ram: 61, disk: 70 },
      { time: "10:00", cpu: 47, ram: 63, disk: 71 },
      { time: "11:00", cpu: 41, ram: 62, disk: 71 }
    ]
  },
  {
    id: "nb-comercial-02",
    name: "NB-COMERCIAL-02",
    ip: "10.10.8.62",
    status: "problem",
    uptimeHours: 47,
    metrics: {
      cpu: 78,
      ram: 84,
      disk: 69,
      networkInMbps: 24,
      networkOutMbps: 16
    },
    history: [
      { time: "08:00", cpu: 51, ram: 66, disk: 68 },
      { time: "09:00", cpu: 63, ram: 73, disk: 68 },
      { time: "10:00", cpu: 80, ram: 85, disk: 69 },
      { time: "11:00", cpu: 78, ram: 84, disk: 69 }
    ]
  },
  {
    id: "srv-files-01",
    name: "SRV-FILES-01",
    ip: "10.10.1.75",
    status: "online",
    uptimeHours: 1006,
    metrics: {
      cpu: 29,
      ram: 57,
      disk: 81,
      networkInMbps: 84,
      networkOutMbps: 112
    },
    history: [
      { time: "08:00", cpu: 24, ram: 53, disk: 80 },
      { time: "09:00", cpu: 28, ram: 55, disk: 80 },
      { time: "10:00", cpu: 33, ram: 58, disk: 81 },
      { time: "11:00", cpu: 29, ram: 57, disk: 81 }
    ]
  },
  {
    id: "srv-auth-01",
    name: "SRV-AUTH-01",
    ip: "10.10.1.12",
    status: "online",
    uptimeHours: 1534,
    metrics: {
      cpu: 16,
      ram: 49,
      disk: 45,
      networkInMbps: 54,
      networkOutMbps: 36
    },
    history: [
      { time: "08:00", cpu: 14, ram: 47, disk: 45 },
      { time: "09:00", cpu: 15, ram: 48, disk: 45 },
      { time: "10:00", cpu: 18, ram: 50, disk: 45 },
      { time: "11:00", cpu: 16, ram: 49, disk: 45 }
    ]
  },
  {
    id: "sw-core-01",
    name: "SW-CORE-01",
    ip: "10.10.0.10",
    status: "online",
    uptimeHours: 3201,
    metrics: {
      cpu: 12,
      ram: 35,
      disk: 28,
      networkInMbps: 850,
      networkOutMbps: 790
    },
    history: [
      { time: "08:00", cpu: 10, ram: 34, disk: 28 },
      { time: "09:00", cpu: 11, ram: 34, disk: 28 },
      { time: "10:00", cpu: 13, ram: 36, disk: 28 },
      { time: "11:00", cpu: 12, ram: 35, disk: 28 }
    ]
  },
  {
    id: "cam-nvr-01",
    name: "CAM-NVR-01",
    ip: "10.10.2.10",
    status: "problem",
    uptimeHours: 412,
    metrics: {
      cpu: 69,
      ram: 76,
      disk: 94,
      networkInMbps: 155,
      networkOutMbps: 12
    },
    history: [
      { time: "08:00", cpu: 56, ram: 70, disk: 92 },
      { time: "09:00", cpu: 61, ram: 73, disk: 93 },
      { time: "10:00", cpu: 72, ram: 77, disk: 94 },
      { time: "11:00", cpu: 69, ram: 76, disk: 94 }
    ]
  },
  {
    id: "kiosk-rec-01",
    name: "KIOSK-REC-01",
    ip: "10.10.9.90",
    status: "online",
    uptimeHours: 18,
    metrics: {
      cpu: 37,
      ram: 48,
      disk: 42,
      networkInMbps: 6,
      networkOutMbps: 4
    },
    history: [
      { time: "08:00", cpu: 29, ram: 44, disk: 42 },
      { time: "09:00", cpu: 34, ram: 46, disk: 42 },
      { time: "10:00", cpu: 39, ram: 49, disk: 42 },
      { time: "11:00", cpu: 37, ram: 48, disk: 42 }
    ]
  },
  {
    id: "srv-erp-01",
    name: "SRV-ERP-01",
    ip: "10.10.1.33",
    status: "online",
    uptimeHours: 884,
    metrics: { cpu: 52, ram: 68, disk: 74, networkInMbps: 96, networkOutMbps: 58 },
    history: [
      { time: "08:00", cpu: 43, ram: 63, disk: 73 },
      { time: "09:00", cpu: 49, ram: 66, disk: 73 },
      { time: "10:00", cpu: 56, ram: 69, disk: 74 },
      { time: "11:00", cpu: 52, ram: 68, disk: 74 }
    ]
  },
  {
    id: "srv-vmhost-02",
    name: "SRV-VMHOST-02",
    ip: "10.10.1.34",
    status: "online",
    uptimeHours: 1678,
    metrics: { cpu: 38, ram: 72, disk: 66, networkInMbps: 180, networkOutMbps: 126 },
    history: [
      { time: "08:00", cpu: 31, ram: 68, disk: 65 },
      { time: "09:00", cpu: 36, ram: 70, disk: 66 },
      { time: "10:00", cpu: 42, ram: 73, disk: 66 },
      { time: "11:00", cpu: 38, ram: 72, disk: 66 }
    ]
  },
  {
    id: "srv-mail-01",
    name: "SRV-MAIL-01",
    ip: "10.10.1.44",
    status: "online",
    uptimeHours: 704,
    metrics: { cpu: 24, ram: 55, disk: 59, networkInMbps: 37, networkOutMbps: 44 },
    history: [
      { time: "08:00", cpu: 18, ram: 52, disk: 58 },
      { time: "09:00", cpu: 23, ram: 54, disk: 58 },
      { time: "10:00", cpu: 28, ram: 56, disk: 59 },
      { time: "11:00", cpu: 24, ram: 55, disk: 59 }
    ]
  },
  {
    id: "srv-mon-01",
    name: "SRV-MON-01",
    ip: "10.10.1.50",
    status: "problem",
    uptimeHours: 612,
    metrics: { cpu: 64, ram: 86, disk: 78, networkInMbps: 72, networkOutMbps: 36 },
    history: [
      { time: "08:00", cpu: 45, ram: 73, disk: 76 },
      { time: "09:00", cpu: 58, ram: 80, disk: 77 },
      { time: "10:00", cpu: 67, ram: 87, disk: 78 },
      { time: "11:00", cpu: 64, ram: 86, disk: 78 }
    ]
  },
  {
    id: "ws-contab-01",
    name: "WS-CONTAB-01",
    ip: "10.10.7.51",
    status: "online",
    uptimeHours: 78,
    metrics: { cpu: 22, ram: 46, disk: 54, networkInMbps: 8, networkOutMbps: 5 },
    history: [
      { time: "08:00", cpu: 18, ram: 42, disk: 54 },
      { time: "09:00", cpu: 21, ram: 45, disk: 54 },
      { time: "10:00", cpu: 25, ram: 47, disk: 54 },
      { time: "11:00", cpu: 22, ram: 46, disk: 54 }
    ]
  },
  {
    id: "ws-contab-02",
    name: "WS-CONTAB-02",
    ip: "10.10.7.52",
    status: "online",
    uptimeHours: 64,
    metrics: { cpu: 29, ram: 52, disk: 62, networkInMbps: 10, networkOutMbps: 6 },
    history: [
      { time: "08:00", cpu: 24, ram: 48, disk: 61 },
      { time: "09:00", cpu: 28, ram: 50, disk: 61 },
      { time: "10:00", cpu: 32, ram: 53, disk: 62 },
      { time: "11:00", cpu: 29, ram: 52, disk: 62 }
    ]
  },
  {
    id: "ws-juridico-01",
    name: "WS-JURIDICO-01",
    ip: "10.10.5.41",
    status: "online",
    uptimeHours: 96,
    metrics: { cpu: 17, ram: 39, disk: 47, networkInMbps: 6, networkOutMbps: 4 },
    history: [
      { time: "08:00", cpu: 14, ram: 36, disk: 47 },
      { time: "09:00", cpu: 16, ram: 38, disk: 47 },
      { time: "10:00", cpu: 20, ram: 40, disk: 47 },
      { time: "11:00", cpu: 17, ram: 39, disk: 47 }
    ]
  },
  {
    id: "ws-compras-04",
    name: "WS-COMPRAS-04",
    ip: "10.10.5.64",
    status: "online",
    uptimeHours: 41,
    metrics: { cpu: 34, ram: 57, disk: 58, networkInMbps: 12, networkOutMbps: 9 },
    history: [
      { time: "08:00", cpu: 26, ram: 53, disk: 57 },
      { time: "09:00", cpu: 31, ram: 55, disk: 57 },
      { time: "10:00", cpu: 38, ram: 58, disk: 58 },
      { time: "11:00", cpu: 34, ram: 57, disk: 58 }
    ]
  },
  {
    id: "ws-logistica-06",
    name: "WS-LOGISTICA-06",
    ip: "10.10.9.46",
    status: "offline",
    uptimeHours: 0,
    metrics: { cpu: 0, ram: 0, disk: 64, networkInMbps: 0, networkOutMbps: 0 },
    history: [
      { time: "08:00", cpu: 28, ram: 49, disk: 64 },
      { time: "09:00", cpu: 30, ram: 51, disk: 64 },
      { time: "10:00", cpu: 0, ram: 0, disk: 64 },
      { time: "11:00", cpu: 0, ram: 0, disk: 64 }
    ]
  },
  {
    id: "ws-suporte-02",
    name: "WS-SUPORTE-02",
    ip: "10.10.4.32",
    status: "online",
    uptimeHours: 135,
    metrics: { cpu: 48, ram: 61, disk: 55, networkInMbps: 18, networkOutMbps: 15 },
    history: [
      { time: "08:00", cpu: 36, ram: 56, disk: 55 },
      { time: "09:00", cpu: 42, ram: 59, disk: 55 },
      { time: "10:00", cpu: 51, ram: 62, disk: 55 },
      { time: "11:00", cpu: 48, ram: 61, disk: 55 }
    ]
  },
  {
    id: "nb-gerencia-03",
    name: "NB-GERENCIA-03",
    ip: "10.10.8.73",
    status: "online",
    uptimeHours: 33,
    metrics: { cpu: 26, ram: 54, disk: 60, networkInMbps: 15, networkOutMbps: 10 },
    history: [
      { time: "08:00", cpu: 20, ram: 49, disk: 59 },
      { time: "09:00", cpu: 24, ram: 52, disk: 60 },
      { time: "10:00", cpu: 29, ram: 55, disk: 60 },
      { time: "11:00", cpu: 26, ram: 54, disk: 60 }
    ]
  },
  {
    id: "nb-ti-01",
    name: "NB-TI-01",
    ip: "10.10.4.81",
    status: "online",
    uptimeHours: 19,
    metrics: { cpu: 44, ram: 67, disk: 57, networkInMbps: 31, networkOutMbps: 20 },
    history: [
      { time: "08:00", cpu: 35, ram: 61, disk: 56 },
      { time: "09:00", cpu: 40, ram: 64, disk: 56 },
      { time: "10:00", cpu: 48, ram: 68, disk: 57 },
      { time: "11:00", cpu: 44, ram: 67, disk: 57 }
    ]
  },
  {
    id: "prd-print-02",
    name: "PRD-PRINT-02",
    ip: "10.10.3.19",
    status: "online",
    uptimeHours: 244,
    metrics: { cpu: 9, ram: 31, disk: 39, networkInMbps: 4, networkOutMbps: 3 },
    history: [
      { time: "08:00", cpu: 8, ram: 29, disk: 39 },
      { time: "09:00", cpu: 10, ram: 30, disk: 39 },
      { time: "10:00", cpu: 11, ram: 31, disk: 39 },
      { time: "11:00", cpu: 9, ram: 31, disk: 39 }
    ]
  }
];

export const zabbixAlerts = [
  {
    id: "alert-1001",
    hostId: "srv-db-01",
    hostName: "SRV-DB-01",
    severity: "critical",
    title: "High memory utilization",
    description: "RAM usage is above 90% for more than 10 minutes.",
    status: "active",
    startedAt: "2026-05-05T10:41:00.000Z"
  },
  {
    id: "alert-1002",
    hostId: "srv-db-01",
    hostName: "SRV-DB-01",
    severity: "warning",
    title: "CPU pressure detected",
    description: "CPU average usage is above 85%.",
    status: "active",
    startedAt: "2026-05-05T10:48:00.000Z"
  },
  {
    id: "alert-1003",
    hostId: "ws-fin-07",
    hostName: "WS-FIN-07",
    severity: "critical",
    title: "Host unavailable",
    description: "Zabbix agent is unreachable.",
    status: "active",
    startedAt: "2026-05-05T09:02:00.000Z"
  },
  {
    id: "alert-0999",
    hostId: "srv-web-01",
    hostName: "SRV-WEB-01",
    severity: "warning",
    title: "Disk usage trend",
    description: "Disk usage increased 12% in the last 24 hours.",
    status: "resolved",
    startedAt: "2026-05-04T17:10:00.000Z",
    resolvedAt: "2026-05-04T18:30:00.000Z"
  },
  {
    id: "alert-1004",
    hostId: "srv-bkp-01",
    hostName: "SRV-BKP-01",
    severity: "warning",
    title: "Backup storage near capacity",
    description: "Backup volume disk usage is above 85%.",
    status: "active",
    startedAt: "2026-05-05T11:04:00.000Z"
  },
  {
    id: "alert-1005",
    hostId: "nb-diretoria-01",
    hostName: "NB-DIRETORIA-01",
    severity: "critical",
    title: "Notebook disconnected",
    description: "Device has not reported telemetry in the last 30 minutes.",
    status: "active",
    startedAt: "2026-05-05T10:22:00.000Z"
  },
  {
    id: "alert-1006",
    hostId: "ws-caixa-03",
    hostName: "WS-CAIXA-03",
    severity: "critical",
    title: "Caixa sem comunicacao",
    description: "Estacao de caixa esta offline desde a ultima coleta.",
    status: "active",
    startedAt: "2026-05-05T11:12:00.000Z"
  },
  {
    id: "alert-1007",
    hostId: "cam-nvr-01",
    hostName: "CAM-NVR-01",
    severity: "warning",
    title: "Armazenamento de cameras quase cheio",
    description: "Volume de gravacao atingiu 94% de uso.",
    status: "active",
    startedAt: "2026-05-05T11:26:00.000Z"
  },
  {
    id: "alert-1008",
    hostId: "nb-comercial-02",
    hostName: "NB-COMERCIAL-02",
    severity: "warning",
    title: "Notebook com alto consumo",
    description: "CPU e memoria permaneceram acima do esperado por 15 minutos.",
    status: "active",
    startedAt: "2026-05-05T11:31:00.000Z"
  },
  {
    id: "alert-1009",
    hostId: "srv-mon-01",
    hostName: "SRV-MON-01",
    severity: "warning",
    title: "Monitoramento com memoria elevada",
    description: "Servidor de monitoramento esta usando mais de 85% de RAM.",
    status: "active",
    startedAt: "2026-05-06T10:18:00.000Z"
  },
  {
    id: "alert-1010",
    hostId: "ws-logistica-06",
    hostName: "WS-LOGISTICA-06",
    severity: "critical",
    title: "Estacao da logistica indisponivel",
    description: "Estacao nao responde desde a ultima coleta do agente.",
    status: "active",
    startedAt: "2026-05-06T10:24:00.000Z"
  }
];
