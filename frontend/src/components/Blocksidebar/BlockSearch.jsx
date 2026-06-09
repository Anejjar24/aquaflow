export default function BlockSearch({ value, onChange }) {
  return (
    <label className="workflow-search">
      <i className="fa fa-search" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search blocks"
        type="search"
      />
    </label>
  );
}
