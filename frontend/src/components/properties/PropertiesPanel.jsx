import { getBlockDefinition } from "registry/blockRegistry";
import PropertyField from "./PropertyField";

export default function PropertiesPanel({ editor }) {
  const workflow = editor.selectedNode?.get("workflow");
  const definition = workflow ? getBlockDefinition(workflow.type) : null;

  const handleChange = (name, value) => {
    editor.updateSelectedNode({ [name]: value });
  };

  return (
    <aside className="properties-panel">
      <div className="panel-heading">
        <span>Properties</span>
        <small>{workflow ? workflow.title : "No selection"}</small>
      </div>
      {!workflow && (
        <div className="empty-state">
          Select a node to edit its configuration.
        </div>
      )}
      {workflow && definition && (
        <>
          <div className="node-summary">
            <span className="block-icon" style={{ backgroundColor: workflow.color }}>
              <i className={`fa ${workflow.icon}`} aria-hidden="true" />
            </span>
            <div>
              <strong>{workflow.title}</strong>
              <small>{definition.description}</small>
            </div>
          </div>
          <div className="property-stack">
            {definition.properties
              .filter((field) => {
                const data = workflow.data ?? {};
                // showFor — shorthand: checks against the "operation" field
                if (field.showFor) {
                  const op = data.operation
                    ?? definition.properties.find((f) => f.name === "operation")?.defaultValue;
                  if (!field.showFor.includes(op)) return false;
                }
                // showWhen — generic: checks against any named field
                if (field.showWhen) {
                  const controlling = data[field.showWhen.field]
                    ?? definition.properties.find((f) => f.name === field.showWhen.field)?.defaultValue;
                  if (!field.showWhen.values.includes(controlling)) return false;
                }
                return true;
              })
              .map((field) => (
                <PropertyField
                  field={field}
                  key={field.name}
                  onChange={handleChange}
                  value={workflow.data?.[field.name]}
                  allValues={workflow.data}
                />
              ))}
          </div>
        </>
      )}
    </aside>
  );
}
