import { useEffect, useState } from "react";
import { getBlockDefinition } from "registry/blockRegistry";
import PropertyField from "./PropertyField";

export default function NodeEditorModal({ node, onClose, onSave }) {
  const workflow = node?.get("workflow");
  const definition = workflow ? getBlockDefinition(workflow.type) : null;
  const [properties, setProperties] = useState({});

  useEffect(() => {
    setProperties(workflow?.data || {});
  }, [workflow]);

  if (!node || !definition) return null;

  return (
    <div className="modal-backdrop">
      <div className="node-modal">
        <header>
          <div>
            <strong>Edit {workflow.title}</strong>
            <small>Double-click editor</small>
          </div>
          <button onClick={onClose} title="Close" type="button">
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="property-stack">
          {definition.properties
            .filter((field) => {
              // showFor — shorthand: checks against the "operation" field
              if (field.showFor) {
                const op = properties.operation
                  ?? definition.properties.find((f) => f.name === "operation")?.defaultValue;
                if (!field.showFor.includes(op)) return false;
              }
              // showWhen — generic: checks against any named field
              if (field.showWhen) {
                const controlling = properties[field.showWhen.field]
                  ?? definition.properties.find((f) => f.name === field.showWhen.field)?.defaultValue;
                if (!field.showWhen.values.includes(controlling)) return false;
              }
              return true;
            })
            .map((field) => (
              <PropertyField
                field={field}
                key={field.name}
                onChange={(name, value) => setProperties((current) => ({ ...current, [name]: value }))}
                value={properties[field.name]}
                allValues={properties}
              />
            ))}
        </div>
        <footer>
          <button onClick={onClose} type="button">Cancel</button>
          <button
            className="primary-action"
            onClick={() => {
              onSave(properties);
              onClose();
            }}
            type="button"
          >
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
