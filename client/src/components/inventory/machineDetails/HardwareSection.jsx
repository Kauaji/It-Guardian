export default function HardwareSection({ icon: Icon, title, children }) {
  return (
    <section className="hardware-detail-section">
      <header>
        <Icon size={18} aria-hidden="true" />
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}
