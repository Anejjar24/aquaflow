import { useMemo, useState } from "react";
import { getBlockCategories } from "registry/blockRegistry";
import BlockCategory from "./BlockCategory";
import BlockSearch from "./BlockSearch";

export default function BlockSidebar() {
  const [query, setQuery] = useState("");
  const categories = useMemo(() => getBlockCategories(), []);
  const normalizedQuery = query.trim().toLowerCase();

  return (
    <aside className="workflow-sidebar">
      <div className="panel-heading">
        <span>Blocks</span>
        <small>Drag to canvas</small>
      </div>
      <BlockSearch value={query} onChange={setQuery} />
      <div className="category-stack">
        {Object.entries(categories).map(([category, blocks]) => {
          const filtered = blocks.filter((block) => {
            const text = `${block.title} ${block.description} ${block.category}`.toLowerCase();
            return text.includes(normalizedQuery);
          });
          if (!filtered.length) return null;
          return <BlockCategory blocks={filtered} key={category} title={category} />;
        })}
      </div>
    </aside>
  );
}
