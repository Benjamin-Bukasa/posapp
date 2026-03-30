const PermissionMatrix = ({
  value = {},
  onChange,
  catalog = [],
  disabled = false,
}) => {
  const selectedCount = Object.values(value).filter(Boolean).length;

  const toggleCode = (code, checked) => {
    onChange({
      ...value,
      [code]: checked,
    });
  };

  const toggleModule = (moduleItem, checked) => {
    const nextValue = { ...value };
    moduleItem.actions.forEach((action) => {
      nextValue[action.code] = checked;
    });
    onChange(nextValue);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            Matrice des permissions
          </p>
          <p className="text-xs text-text-secondary">
            Selectionnez une ou plusieurs operations par module.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-medium text-text-secondary">
          {selectedCount} permission(s)
        </span>
      </div>

      <div className="space-y-3">
        {catalog.map((moduleItem) => {
          const allChecked =
            moduleItem.actions.length > 0 &&
            moduleItem.actions.every((action) => Boolean(value[action.code]));

          return (
            <section
              key={moduleItem.key}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold text-text-primary">
                    {moduleItem.label}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {moduleItem.description}
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    disabled={disabled}
                    onChange={(event) => toggleModule(moduleItem, event.target.checked)}
                  />
                  Tout cocher
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {moduleItem.actions.map((action) => (
                  <label
                    key={action.code}
                    className="inline-flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(value[action.code])}
                      disabled={disabled}
                      onChange={(event) =>
                        toggleCode(action.code, event.target.checked)
                      }
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{action.label}</p>
                      <p className="truncate text-xs text-text-secondary">
                        {action.code}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default PermissionMatrix;
