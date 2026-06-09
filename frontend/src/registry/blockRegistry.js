import { workflowBlocks } from "data/blocks";

const registry = new Map(workflowBlocks.map((block) => [block.type, block]));

export function getBlockDefinition(type) {
  return registry.get(type);
}

export function getBlockTypes() {
  return Array.from(registry.values());
}

export function getBlockCategories() {
  return getBlockTypes().reduce((categories, block) => {
    const category = block.category || "Other";
    categories[category] = categories[category] || [];
    categories[category].push(block);
    return categories;
  }, {});
}

export function getDefaultProperties(type) {
  const definition = getBlockDefinition(type);
  if (!definition) return {};

  return definition.properties.reduce((properties, field) => {
    properties[field.name] = field.defaultValue ?? "";
    return properties;
  }, {});
}
