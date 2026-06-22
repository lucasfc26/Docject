import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export function useFocusFromUrl(onFocus: (id: string) => void) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");

  useEffect(() => {
    if (!focusId) return;
    onFocus(focusId);
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  }, [focusId, onFocus, searchParams, setSearchParams]);
}

export function scrollToFocusRow(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(`focus-row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
