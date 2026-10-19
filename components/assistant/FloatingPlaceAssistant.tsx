"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { chatCopy } from "@/lib/assistant/chat-copy";

const PlaceAssistant = dynamic(() => import("./PlaceAssistant"), {
  ssr: false,
});

function FloatingPlaceAssistant({
  open,
  hasOpened,
  onClose,
}: {
  open: boolean;
  hasOpened: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !dialog) return;
    const media = window.matchMedia("(max-width: 767px)");
    const previousOverflow = document.body.style.overflow;
    let focusFrame = 0;
    if (open)
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    const syncMode = () => {
      if (!open) return;
      const modal = media.matches;
      if (!dialog.open || modalRef.current !== modal) {
        if (dialog.open) dialog.close();
        modalRef.current = modal;
        if (modal) dialog.showModal();
        else dialog.show();
        dialog.setAttribute("aria-modal", String(modal));
      }
      document.body.style.overflow = modal ? "hidden" : previousOverflow;
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() =>
        dialog
          .querySelector<HTMLTextAreaElement>("textarea")
          ?.focus({ preventScroll: true }),
      );
    };
    if (open) syncMode();
    else if (dialog.open) {
      dialog.close();
      openerRef.current?.focus({ preventScroll: true });
    }
    media.addEventListener("change", syncMode);
    return () => {
      cancelAnimationFrame(focusFrame);
      media.removeEventListener("change", syncMode);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted]);

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      id="home-ai-dialog"
      aria-label={chatCopy(locale).title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (!dialogRef.current?.open && open) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onClick={(event) => {
        if (!modalRef.current || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
      className="fixed inset-auto bottom-0 left-0 right-0 z-[180] m-0 h-[88dvh] max-h-none w-full max-w-none overflow-hidden rounded-t-[24px] border border-line bg-canvas p-0 text-ink shadow-[0_12px_60px_rgba(15,23,42,0.22)] backdrop:bg-slate-950/25 md:bottom-5 md:left-auto md:right-5 md:h-[min(740px,calc(100dvh-6rem))] md:w-[min(520px,calc(100vw-2.5rem))] md:rounded-[24px]"
    >
      {hasOpened && <PlaceAssistant visible={open} onMinimize={onClose} />}
    </dialog>,
    document.body,
  );
}
export default memo(FloatingPlaceAssistant);
