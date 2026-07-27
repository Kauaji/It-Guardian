const SOURCE_LABELS = {
  agent: "Agent",
  manual: "Manual",
  mock: "Mock",
  zabbix: "Zabbix",
  ocs: "OCS"
};

export function getMachineSourceLabel(machine) {
  return SOURCE_LABELS[machine?.source] || "OCS";
}

export function isAgentMachine(machine) {
  return machine?.source === "agent";
}

export function getAgentLastSeenAt(machine) {
  return machine?.lastSeenAt || machine?.agent?.lastSeenAt || null;
}

export function getAgentHeartbeatState(
  machine,
  { now = Date.now(), minimumOfflineAfterSeconds = 180 } = {}
) {
  if (!isAgentMachine(machine)) {
    return { status: null, lastSeenAt: null };
  }

  const lastSeenAt = getAgentLastSeenAt(machine);
  if (machine.status === "online" || machine.status === "offline") {
    return { status: machine.status, lastSeenAt };
  }

  const lastSeenTime = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenTime)) {
    return { status: "offline", lastSeenAt };
  }

  const intervalSeconds = Math.max(30, Number(machine?.agent?.intervalSeconds || 60));
  const thresholdSeconds = Math.max(minimumOfflineAfterSeconds, intervalSeconds * 3);
  return {
    status: now - lastSeenTime <= thresholdSeconds * 1000 ? "online" : "offline",
    lastSeenAt
  };
}
