import { Modal } from "@/components/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, message, danger = false, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>
            انصراف
          </button>
          <button className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm}>
            تایید
          </button>
        </>
      }
    >
      <p className="text-slate-700">{message}</p>
    </Modal>
  );
}
