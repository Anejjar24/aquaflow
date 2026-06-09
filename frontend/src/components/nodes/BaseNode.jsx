export default function BaseNode({ icon, title, subtitle, color }) {
  return (
    <div className="node-preview">
      <span className="block-icon" style={{ backgroundColor: color }}>
        <i className={`fa ${icon}`} aria-hidden="true" />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}
