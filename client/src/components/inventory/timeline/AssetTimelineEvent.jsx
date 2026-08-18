import {
  AlertTriangle,
  CalendarCheck2,
  ClipboardList,
  Cpu,
  FolderTree,
  MessageSquare,
  MonitorSmartphone,
  Package,
  PlusCircle,
  Settings2,
  Waypoints,
  Wrench
} from "lucide-react";
import { formatEventDateTime, formatRelativeTime } from "./assetTimelineFormatters.js";
import { severityToken } from "./assetTimelineModel.js";

const CATEGORY_ICONS = {
  service_order: ClipboardList,
  alert: AlertTriangle,
  maintenance: Wrench,
  preventive: CalendarCheck2,
  remote_assistance: MonitorSmartphone,
  hardware: Cpu,
  segment: FolderTree,
  observation: MessageSquare,
  topology: Waypoints,
  part: Package,
  asset: PlusCircle,
  system: Settings2
};

export default function AssetTimelineEvent({ event }) {
  const Icon = CATEGORY_ICONS[event.category] || Settings2;

  return (
    <article className={`asset-timeline-event severity-${severityToken(event.severity)}`}>
      <div className="asset-timeline-event-icon">
        <Icon size={15} />
      </div>
      <div className="asset-timeline-event-body">
        <header>
          <strong>{event.title}</strong>
          <time title={formatEventDateTime(event.occurredAt)}>{formatRelativeTime(event.occurredAt)}</time>
        </header>
        {event.description && <p>{event.description}</p>}
        {event.actorName && <span className="asset-timeline-event-actor">{event.actorName}</span>}
      </div>
    </article>
  );
}
