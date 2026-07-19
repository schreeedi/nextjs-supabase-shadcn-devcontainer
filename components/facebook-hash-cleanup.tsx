"use client";

import { useEffect } from "react";

/**
 * Facebook's OAuth redirect appends `#_=_` to the final URL (their marker
 * for "no fragment"). Browsers carry fragments across redirects, so it ends
 * up on whatever page the login flow lands on. Strip it without adding a
 * history entry.
 */
export function FacebookHashCleanup() {
  useEffect(() => {
    if (window.location.hash === "#_=_") {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  return null;
}
