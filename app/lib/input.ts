"use client";

import { useEffect } from "react";

const selector = "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])";

export function useDirectionalNavigation(rootSelector: string) {
  useEffect(() => {
    const move = (direction: number) => {
      const root = document.querySelector(rootSelector);
      if (!root) return;
      const controls = [...root.querySelectorAll<HTMLElement>(selector)].filter((control) => control.offsetParent !== null);
      if (!controls.length) return;
      const current = controls.indexOf(document.activeElement as HTMLElement);
      controls[(current + direction + controls.length) % controls.length].focus();
    };
    const key = (event: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
      if (["INPUT", "SELECT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) return;
      event.preventDefault(); move(["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1);
    };
    window.addEventListener("keydown", key);
    let frame = 0, held = false;
    const controller = () => {
      const pad = navigator.getGamepads?.()[0];
      const directional = Boolean(pad && (pad.buttons[12]?.pressed || pad.buttons[13]?.pressed || pad.buttons[14]?.pressed || pad.buttons[15]?.pressed || Math.abs(pad.axes[0] || 0) > .65 || Math.abs(pad.axes[1] || 0) > .65));
      if (directional && !held) {
        const backwards = Boolean(pad?.buttons[12]?.pressed || pad?.buttons[14]?.pressed || (pad?.axes[0] || 0) < -.65 || (pad?.axes[1] || 0) < -.65);
        move(backwards ? -1 : 1);
      }
      if (pad?.buttons[0]?.pressed && !held && document.activeElement instanceof HTMLElement) document.activeElement.click();
      held = directional || Boolean(pad?.buttons[0]?.pressed);
      frame = requestAnimationFrame(controller);
    };
    frame = requestAnimationFrame(controller);
    return () => { window.removeEventListener("keydown", key); cancelAnimationFrame(frame); };
  }, [rootSelector]);
}
