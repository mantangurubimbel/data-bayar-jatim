"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

export function ModalCloseLink(props: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        props.onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        const modalRoot = event.currentTarget.closest("[data-modal-root]");
        if (modalRoot instanceof HTMLElement) {
          modalRoot.style.display = "none";
        }
      }}
    />
  );
}
