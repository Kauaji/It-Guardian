import { detailTabs } from "../utils/constants.js";

export default function DetailsTabBar({ activeTab, onSelect }) {
  return (
    <div className="machine-tabs">
      {detailTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
