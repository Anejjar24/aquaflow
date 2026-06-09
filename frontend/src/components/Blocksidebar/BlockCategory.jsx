export default function BlockCategory({ title, blocks }) {
  return (
    <section className="block-category">
      <h3>{title}</h3>
      <div className="block-list">
        {blocks.map((block) => (
          <button
            className="block-palette-item"
            draggable
            key={block.type}
            onDragStart={(event) => {
              event.dataTransfer.setData("application/workflow-block", block.type);
              event.dataTransfer.effectAllowed = "copy";
            }}
            type="button"
          >
            <span className="block-icon" style={{ backgroundColor: block.color }}>
              <i className={`fa ${block.icon}`} aria-hidden="true" />
            </span>
            <span>
              <strong>{block.title}</strong>
              <small>{block.description}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
