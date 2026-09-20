"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { IconFileTypePdf, IconFileTypeXls, IconX } from "@tabler/icons-react";

export default function ExportDialog({
  open,
  onOpenChange,
  onPdf,
  onXls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPdf: () => void;
  onXls: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal modal--export" aria-describedby={undefined}>
          <div className="modal__bar">
            <Dialog.Title className="modal__title">Export template</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Close"><IconX size={20} /></Dialog.Close>
          </div>
          <p className="modal__desc">Hidden sections, subsections and comments are left out.</p>
          <div className="export-options">
            <button className="export-option" onClick={onPdf}>
              <IconFileTypePdf size={28} stroke={1.5} />
              <strong>PDF</strong>
              <span>A printable document</span>
            </button>
            <button className="export-option" onClick={onXls}>
              <IconFileTypeXls size={28} stroke={1.5} />
              <strong>XLS</strong>
              <span>A spreadsheet you can import again</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
