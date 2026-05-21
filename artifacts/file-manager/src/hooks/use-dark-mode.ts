import { useState, useEffect } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false;
    const saved = localStorage.getItem("fileorbit-theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("fileorbit-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("fileorbit-theme", "light");
    }
  }, [dark]);

  return [dark, setDark] as const;
}
