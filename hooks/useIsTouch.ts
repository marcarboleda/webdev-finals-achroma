"use client";

import { useEffect, useState } from "react";

export default function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const isTouch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
    setTouch(isTouch);
  }, []);
  return touch;
}
