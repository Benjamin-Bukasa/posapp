import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { API_URL, ApiError, requestFormData, requestJson } from "../api/client";
import SearchSelect from "../components/ui/SearchSelect";
import PermissionMatrix from "../components/ui/PermissionMatrix";
import ImageUploadField from "../components/ui/ImageUploadField";
import {
  findRouteByPath,
  getCreatePageConfig,
  getEditPageConfig,
  getRouteActionPermissions,
} from "../routes/router";
import useAuthStore from "../stores/authStore";
import useCurrencyStore from "../stores/currencyStore";
import useToastStore from "../stores/toastStore";
import { hasAnyPermission } from "../utils/permissions";

const pickRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const resolvePath = (source, accessor) => {
  if (typeof accessor === "function") return accessor(source);
  if (!accessor) return source;

  return String(accessor)
    .split(".")
    .reduce((value, part) => (value == null ? value : value[part]), source);
};

const fieldSourceKey = (field) =>
  `${field.optionsEndpoint || ""}::${JSON.stringify(field.query || {})}`;

const getDefaultFieldValue = (field, index = 0) => {
  if (typeof field.initialValue === "function") {
    return field.initialValue(index);
  }

  if (field.initialValue !== undefined) {
    return field.initialValue;
  }

  if (field.type === "checkbox") return false;
  if (field.type === "permission-matrix") return {};
  return "";
};

const buildRow = (repeater, index = 0) => {
  if (typeof repeater.createRow === "function") {
    return repeater.createRow(index);
  }

  return (repeater.fields || []).reduce(
    (accumulator, field) => ({
      ...accumulator,
      [field.name]: getDefaultFieldValue(field, index),
    }),
    {},
  );
};

const buildInitialValues = (config) => {
  const baseValues = (config?.fields || []).reduce(
    (accumulator, field) => ({
      ...accumulator,
      [field.name]: getDefaultFieldValue(field),
    }),
    {},
  );

  (config?.repeaters || []).forEach((repeater) => {
    const minRows = repeater.minRows || 0;
    baseValues[repeater.name] = Array.from({ length: minRows }, (_, index) =>
      buildRow(repeater, index),
    );
  });

  return baseValues;
};

const collectOptionFields = (config) => {
  const topFields = config?.fields || [];
  const repeaterFields = (config?.repeaters || []).flatMap(
    (repeater) => repeater.fields || [],
  );

  return [...topFields, ...repeaterFields].filter((field) => field.optionsEndpoint);
};

const normalizeOptions = (field, rows) => {
  if (field.type === "permission-matrix") {
    return Array.isArray(rows?.modules) ? rows.modules : Array.isArray(rows) ? rows : [];
  }

  return rows
    .map((item) => ({
      value: resolvePath(item, field.optionValue || "id"),
      label: resolvePath(item, field.optionLabel || "name"),
    }))
    .filter((item) => item.value !== undefined && item.value !== null);
};

const inputClassName =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary";

const resolveMediaUrl = (value) => {
  if (!value) return "";
  if (
    String(value).startsWith("http://") ||
    String(value).startsWith("https://") ||
    String(value).startsWith("blob:") ||
    String(value).startsWith("data:")
  ) {
    return value;
  }
  return value.startsWith("/")
    ? `${API_URL}${value}`
    : `${API_URL}/${String(value).replace(/^\/+/, "")}`;
};

const renderFieldInput = ({
  field,
  value,
  onChange,
  options = [],
  disabled = false,
  uploading = false,
  onFileSelect,
  onClear,
}) => {
  const commonProps = {
    name: field.name,
    required: field.required,
    disabled,
    className: inputClassName,
  };

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          {...commonProps}
          rows={field.rows || 4}
          value={value ?? ""}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "select":
      return (
        <select
          {...commonProps}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{field.placeholder || "Selectionner..."}</option>
          {options.map((option) => (
            <option key={`${field.name}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "search-select":
      return (
        <SearchSelect
          name={field.name}
          value={value ?? ""}
          onChange={onChange}
          options={options}
          required={field.required}
          placeholder={field.placeholder || "Rechercher..."}
          disabled={disabled}
          emptyMessage={field.emptyMessage}
        />
      );

    case "checkbox":
      return (
        <label className="inline-flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          {field.checkboxLabel || field.label}
        </label>
      );

    case "permission-matrix":
      return (
        <PermissionMatrix
          value={value ?? {}}
          onChange={onChange}
          catalog={options}
          disabled={disabled}
        />
      );

    case "image-upload":
      return (
        <ImageUploadField
          value={resolveMediaUrl(value)}
          onFileSelect={onFileSelect}
          onClear={onClear}
          disabled={disabled}
          uploading={uploading}
          accept={field.accept || "image/*"}
          maxSizeMb={field.maxSizeMb || 5}
          helper={field.helper}
        />
      );

    default:
      return (
        <input
          {...commonProps}
          type={field.type || "text"}
          value={value ?? ""}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
};

const AdminCreatePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentRoute = findRouteByPath(location.pathname);
  const editConfig = getEditPageConfig(location.pathname);
  const createConfig = getCreatePageConfig(location.pathname);
  const formConfig = editConfig || createConfig;
  const isEditing = Boolean(editConfig);
  const recordId = searchParams.get("id") || "";
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const showToast = useToastStore((state) => state.showToast);
  const currencySettings = useCurrencyStore((state) => state.settings);
  const currencyLoaded = useCurrencyStore((state) => state.loaded);
  const loadCurrencySettings = useCurrencyStore((state) => state.loadSettings);

  const [values, setValues] = useState(() => buildInitialValues(formConfig));
  const [optionStore, setOptionStore] = useState({});
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFields, setUploadingFields] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const watchEffectSignaturesRef = useRef({});
  const fieldEffectRunsRef = useRef({});
  const requiredPermissions = isEditing
    ? formConfig?.editPermissions ||
      formConfig?.requiredPermissions ||
      getRouteActionPermissions(formConfig?.resourcePath || currentRoute.path, "edit")
    : formConfig?.requiredPermissions ||
      getRouteActionPermissions(formConfig?.resourcePath || currentRoute.path, "create");
  const canAccessPage = hasAnyPermission(user, requiredPermissions);

  useEffect(() => {
    setValues(buildInitialValues(formConfig));
    setError("");
    setSuccess("");
    watchEffectSignaturesRef.current = {};
    fieldEffectRunsRef.current = {};
  }, [formConfig]);

  useEffect(() => {
    if (!accessToken || currencyLoaded) return;
    loadCurrencySettings({ token: accessToken });
  }, [accessToken, currencyLoaded, loadCurrencySettings]);

  useEffect(() => {
    if (!formConfig || isEditing) return;
    if (!currencySettings?.primaryCurrencyCode) return;

    const fieldsWithPrimaryCurrencyDefault = (formConfig.fields || []).filter(
      (field) => field.usePrimaryCurrencyDefault,
    );
    if (!fieldsWithPrimaryCurrencyDefault.length) return;

    setValues((current) => {
      const nextValues = { ...current };
      let changed = false;

      fieldsWithPrimaryCurrencyDefault.forEach((field) => {
        if (!nextValues[field.name]) {
          nextValues[field.name] = currencySettings.primaryCurrencyCode;
          changed = true;
        }
      });

      return changed ? nextValues : current;
    });
  }, [currencySettings?.primaryCurrencyCode, formConfig, isEditing]);

  useEffect(() => {
    let ignore = false;

    const loadOptions = async () => {
      if (!formConfig || !accessToken || !canAccessPage) {
        setOptionStore({});
        return;
      }

      const fields = collectOptionFields(formConfig);
      if (!fields.length) {
        setOptionStore({});
        return;
      }

      const uniqueFields = new Map();
      fields.forEach((field) => {
        const key = fieldSourceKey(field);
        if (!uniqueFields.has(key)) {
          uniqueFields.set(key, field);
        }
      });

      setLoadingOptions(true);

      try {
        const entries = await Promise.all(
          [...uniqueFields.entries()].map(async ([key, field]) => {
            const payload = await requestJson(field.optionsEndpoint, {
              token: accessToken,
              query: field.query,
            });

            return [
              key,
              normalizeOptions(
                field,
                field.type === "permission-matrix" ? payload : pickRows(payload),
              ),
            ];
          }),
        );

        if (ignore) return;
        setOptionStore(Object.fromEntries(entries));
      } catch (requestError) {
        if (ignore) return;

        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(requestError.message || "Impossible de charger les options.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible de charger les options.",
          variant: "danger",
        });
      } finally {
        if (!ignore) {
          setLoadingOptions(false);
        }
      }
    };

    loadOptions();

    return () => {
      ignore = true;
    };
  }, [accessToken, canAccessPage, formConfig, logout, navigate, showToast]);

  useEffect(() => {
    let ignore = false;

    const loadRecord = async () => {
      if (!isEditing || !formConfig || !canAccessPage) return;

      const stateRow = location.state?.row;
      if (stateRow && formConfig.buildFormValues) {
        setValues((current) => ({
          ...current,
          ...formConfig.buildFormValues(stateRow),
        }));
        return;
      }

      if (!recordId || !formConfig.detailEndpoint || !accessToken) {
        return;
      }

      setLoadingRecord(true);

      try {
        const payload = await requestJson(formConfig.detailEndpoint(recordId), {
          token: accessToken,
        });

        if (ignore) return;
        if (formConfig.buildFormValues) {
          setValues((current) => ({
            ...current,
            ...formConfig.buildFormValues(payload),
          }));
        }
      } catch (requestError) {
        if (ignore) return;

        if (requestError instanceof ApiError && requestError.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }

        setError(requestError.message || "Impossible de charger cette fiche.");
        showToast({
          title: "Erreur",
          message: requestError.message || "Impossible de charger cette fiche.",
          variant: "danger",
        });
      } finally {
        if (!ignore) {
          setLoadingRecord(false);
        }
      }
    };

    loadRecord();

    return () => {
      ignore = true;
    };
  }, [
    accessToken,
    canAccessPage,
    formConfig,
    isEditing,
    location.state,
    logout,
    navigate,
    recordId,
    showToast,
  ]);

  useEffect(() => {
    const watchEffects = formConfig?.watchEffects || [];
    if (!watchEffects.length || !accessToken || !canAccessPage) {
      return undefined;
    }

    let ignore = false;

    const runEffects = async () => {
      for (const effect of watchEffects) {
        const effectId = effect.id || JSON.stringify(effect.fields || []);
        const nextSignature = JSON.stringify(
          (effect.fields || []).map((fieldName) => values[fieldName]),
        );

        if (watchEffectSignaturesRef.current[effectId] === nextSignature) {
          continue;
        }

        watchEffectSignaturesRef.current[effectId] = nextSignature;

        try {
          const patch = await effect.run({
            values,
            isEditing,
            token: accessToken,
            requestJson,
          });

          if (ignore || !patch || typeof patch !== "object") {
            continue;
          }

          setValues((current) => ({
            ...current,
            ...patch,
          }));
        } catch (requestError) {
          if (ignore) return;

          if (requestError instanceof ApiError && requestError.status === 401) {
            await logout();
            navigate("/login", { replace: true });
            return;
          }

          setError(requestError.message || "Impossible de precharger ce formulaire.");
          showToast({
            title: "Erreur",
            message: requestError.message || "Impossible de precharger ce formulaire.",
            variant: "danger",
          });
          return;
        }
      }
    };

    runEffects();

    return () => {
      ignore = true;
    };
  }, [
    accessToken,
    canAccessPage,
    formConfig,
    logout,
    navigate,
    showToast,
    values,
  ]);

  const repeaterMap = useMemo(
    () =>
      Object.fromEntries(
        (formConfig?.repeaters || []).map((repeater) => [repeater.name, repeater]),
      ),
    [formConfig],
  );

  const getFieldOptions = (field) => {
    if (field.options) return field.options;
    if (!field.optionsEndpoint) return [];
    return optionStore[fieldSourceKey(field)] || [];
  };

  if (!formConfig) {
    return null;
  }

  if (!canAccessPage) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-danger">
          Vous n'avez pas la permission d'acceder a cette page.
        </p>
      </section>
    );
  }

  const setFieldValue = (name, nextValue) => {
    const nextValues = {
      ...values,
      [name]: nextValue,
    };

    setValues(nextValues);

    const fieldEffects = (formConfig?.fieldEffects || []).filter(
      (effect) => effect.field === name,
    );

    if (!fieldEffects.length || !accessToken || !canAccessPage) {
      return;
    }

    fieldEffects.forEach((effect) => {
      const effectId = effect.id || `${name}-change`;
      const runKey = JSON.stringify(
        (effect.fields || [name]).map((fieldName) => nextValues[fieldName]),
      );
      fieldEffectRunsRef.current[effectId] = runKey;

      Promise.resolve(
        effect.run({
          values: nextValues,
          isEditing,
          token: accessToken,
          requestJson,
        }),
      )
        .then((patch) => {
          if (
            !patch ||
            typeof patch !== "object" ||
            fieldEffectRunsRef.current[effectId] !== runKey
          ) {
            return;
          }

          setValues((current) => ({
            ...current,
            ...patch,
          }));
        })
        .catch(async (requestError) => {
          if (requestError instanceof ApiError && requestError.status === 401) {
            await logout();
            navigate("/login", { replace: true });
            return;
          }

          setError(requestError.message || "Impossible de precharger ce formulaire.");
          showToast({
            title: "Erreur",
            message: requestError.message || "Impossible de precharger ce formulaire.",
            variant: "danger",
          });
        });
    });
  };

  const setFieldUploading = (name, nextValue) => {
    setUploadingFields((current) => ({
      ...current,
      [name]: nextValue,
    }));
  };

  const uploadFieldFile = async (field, file) => {
    if (!field?.uploadEndpoint || !file || !accessToken) {
      return;
    }

    setFieldUploading(field.name, true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const payload = await requestFormData(field.uploadEndpoint, {
        token: accessToken,
        formData,
      });

      setFieldValue(field.name, payload?.imageUrl || payload?.url || "");
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      showToast({
        title: "Erreur",
        message: requestError.message || "Impossible de telecharger cette image.",
        variant: "danger",
      });
    } finally {
      setFieldUploading(field.name, false);
    }
  };

  const setRepeaterFieldValue = (repeaterName, rowIndex, fieldName, nextValue) => {
    setValues((current) => ({
      ...current,
      [repeaterName]: (current[repeaterName] || []).map((row, index) =>
        index === rowIndex ? { ...row, [fieldName]: nextValue } : row,
      ),
    }));
  };

  const addRepeaterRow = (repeaterName) => {
    const repeater = repeaterMap[repeaterName];
    if (!repeater) return;

    setValues((current) => {
      const rows = current[repeaterName] || [];
      return {
        ...current,
        [repeaterName]: [...rows, buildRow(repeater, rows.length)],
      };
    });
  };

  const removeRepeaterRow = (repeaterName, rowIndex) => {
    const repeater = repeaterMap[repeaterName];
    if (!repeater) return;

    setValues((current) => {
      const rows = current[repeaterName] || [];
      const nextRows = rows.filter((_, index) => index !== rowIndex);

      return {
        ...current,
        [repeaterName]:
          nextRows.length >= (repeater.minRows || 0)
            ? nextRows
            : [buildRow(repeater, 0)],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formConfig) return;
    if (!accessToken) {
      setError("Session manquante.");
      return;
    }
    if (formConfig.unavailableMessage) {
      setError(formConfig.unavailableMessage);
      return;
    }

    if (isEditing && !recordId) {
      setError("Identifiant de modification manquant.");
      return;
    }

    const requests = isEditing
      ? [
          formConfig.buildUpdateRequest
            ? formConfig.buildUpdateRequest(values, recordId, location.state?.row)
            : {
                endpoint: formConfig.detailEndpoint?.(recordId),
                method: "PATCH",
                body: values,
              },
        ]
      : formConfig.buildRequests
        ? formConfig.buildRequests(values)
      : [
          formConfig.buildRequest
            ? formConfig.buildRequest(values)
            : {
                endpoint: formConfig.endpoint,
                method: formConfig.method || "POST",
                body: values,
              },
        ];

    const validRequests = requests.filter(
      (request) => request?.endpoint && request?.method !== undefined,
    );
    const isUploadingAnyField = Object.values(uploadingFields).some(Boolean);

    if (!validRequests.length) {
      setError("Aucune ligne valide a envoyer.");
      return;
    }
    if (isUploadingAnyField) {
      setError("Patientez pendant le telechargement des images.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      for (const request of validRequests) {
        await requestJson(request.endpoint, {
          token: accessToken,
          method: request.method || "POST",
          body: request.body,
        });
      }

      if (
        validRequests.some((request) =>
          String(request.endpoint || "").startsWith("/api/currency-settings"),
        )
      ) {
        await loadCurrencySettings({ token: accessToken, force: true });
      }

      setSuccess(
        isEditing
          ? formConfig.successMessage?.replace("cree", "mise a jour") ||
              "Modification enregistree."
          : formConfig.successMessage || "Creation enregistree.",
      );
      if (!isEditing) {
        setValues(buildInitialValues(formConfig));
        setError("");
      }
      showToast({
        title: isEditing ? "Modification enregistree" : "Creation enregistree",
        message:
          isEditing
            ? `La fiche ${currentRoute.name.toLowerCase()} a ete mise a jour.`
            : `La fiche ${currentRoute.name.toLowerCase()} a ete creee.`,
        variant: "success",
      });
      window.setTimeout(() => {
        navigate(formConfig.resourcePath || "/dashboard", { replace: true });
      }, 500);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(requestError.message || "Impossible d'enregistrer ce formulaire.");
      showToast({
        title: "Erreur",
        message: requestError.message || "Impossible d'enregistrer ce formulaire.",
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!formConfig) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-text-secondary">Page de creation introuvable.</p>
      </section>
    );
  }

  return (
    <div className="layoutSection flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <span className="inline-flex rounded-full bg-header/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
              {currentRoute.sectionLabel}
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-text-primary">
              {isEditing ? `Modifier ${currentRoute.name}` : formConfig.title}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {formConfig.description || currentRoute.summary}
            </p>
          </div>

          <Link
            to={formConfig.resourcePath}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background sm:w-auto"
          >
            <ArrowLeft size={16} />
            Retour
          </Link>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        {loadingRecord ? (
          <div className="mb-4 rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-secondary">
            Chargement de la fiche...
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {(formConfig.fields || []).map((field) => (
            <div
              key={field.name}
              className={
                field.type === "textarea" || field.type === "image-upload"
                  ? "md:col-span-2"
                  : ""
              }
            >
              {field.type !== "checkbox" ? (
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  {field.label}
                </label>
              ) : null}
              {renderFieldInput({
                field,
                value: values[field.name],
                onChange: (nextValue) => setFieldValue(field.name, nextValue),
                options: getFieldOptions(field),
                disabled:
                  loadingOptions ||
                  submitting ||
                  Boolean(field.disabled) ||
                  (isEditing && Boolean(field.disableOnEdit)),
                uploading: Boolean(uploadingFields[field.name]),
                onFileSelect:
                  field.type === "image-upload"
                    ? (file) => uploadFieldFile(field, file)
                    : undefined,
                onClear:
                  field.type === "image-upload"
                    ? () => setFieldValue(field.name, "")
                    : undefined,
              })}
              {field.description ? (
                <p className="mt-2 text-xs text-text-secondary">{field.description}</p>
              ) : null}
            </div>
          ))}
        </div>

        {(formConfig.repeaters || []).map((repeater) => {
          const rows = values[repeater.name] || [];

          return (
            <section
              key={repeater.name}
              className="mt-6 rounded-2xl border border-border bg-background/40 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {repeater.label}
                  </h3>
                  {repeater.description ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      {repeater.description}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => addRepeaterRow(repeater.name)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 sm:w-auto"
                >
                  <Plus size={16} />
                  {repeater.addLabel || "Ajouter"}
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {rows.map((row, rowIndex) => (
                  <div
                    key={`${repeater.name}-${rowIndex}`}
                    className="rounded-2xl border border-border bg-surface p-4"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-semibold text-text-primary">
                        Ligne {rowIndex + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => removeRepeaterRow(repeater.name, rowIndex)}
                        disabled={rows.length <= (repeater.minRows || 0)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/20 px-3 py-2 text-sm text-danger disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        <Trash2 size={15} />
                        Supprimer
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {(repeater.fields || []).map((field) => (
                        <div
                          key={`${repeater.name}-${rowIndex}-${field.name}`}
                          className={field.type === "textarea" ? "md:col-span-2 xl:col-span-3" : ""}
                        >
                          {field.type !== "checkbox" ? (
                            <label className="mb-2 block text-sm font-medium text-text-primary">
                              {field.label}
                            </label>
                          ) : null}
                          {renderFieldInput({
                            field,
                            value: row[field.name],
                            onChange: (nextValue) =>
                              setRepeaterFieldValue(
                                repeater.name,
                                rowIndex,
                                field.name,
                                nextValue,
                              ),
                            options: getFieldOptions(field),
                            disabled:
                              loadingOptions ||
                              submitting ||
                              Boolean(field.disabled) ||
                              (isEditing && Boolean(field.disableOnEdit)),
                            uploading: Boolean(uploadingFields[`${repeater.name}.${rowIndex}.${field.name}`]),
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {formConfig.unavailableMessage ? (
          <div className="mt-6 rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
            {formConfig.unavailableMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            to={formConfig.resourcePath}
            className="inline-flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-background sm:w-auto"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={
              submitting ||
              loadingOptions ||
              loadingRecord ||
              Object.values(uploadingFields).some(Boolean) ||
              Boolean(formConfig.unavailableMessage)
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Save size={16} />
            {submitting
              ? "Enregistrement..."
              : isEditing
                ? "Enregistrer les modifications"
                : formConfig.submitLabel || "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminCreatePage;
