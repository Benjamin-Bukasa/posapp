import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

const useSyncedQuerySearch = (paramName = "q") => {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(paramName) || "";

  const setValue = useCallback(
    (nextValue) => {
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          const normalizedValue = String(nextValue || "");

          if (normalizedValue.trim()) {
            nextParams.set(paramName, normalizedValue);
          } else {
            nextParams.delete(paramName);
          }

          return nextParams;
        },
        { replace: true },
      );
    },
    [paramName, setSearchParams],
  );

  return [value, setValue];
};

export default useSyncedQuerySearch;
