import useThemeStore from "../stores/themeStore";
import { resolveAppearance } from "./appearance";

export const useThemePalette = () => {
  const theme = useThemeStore((state) => state.theme);
  const primaryColor = useThemeStore((state) => state.primaryColor);
  const secondaryColor = useThemeStore((state) => state.secondaryColor);
  const accentColor = useThemeStore((state) => state.accentColor);

  return resolveAppearance({
    theme,
    primaryColor,
    secondaryColor,
    accentColor,
  });
};

export default useThemePalette;
