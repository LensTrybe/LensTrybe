import { useCallback, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

/* One confirm for the whole dashboard.
 *
 * Deleting is the only thing in the product that cannot be undone, and most
 * delete buttons used to do it on the first click. This is the ask.
 *
 * A page needs three small changes rather than its own modal:
 *
 *   const { confirm, confirmDialog } = useConfirm()
 *   onClick={() => confirm({ title: 'Delete this invoice?', onConfirm: () => del(id) })}
 *   {confirmDialog}
 */
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)

  const confirm = useCallback((opts) => setRequest(opts), [])
  const close = useCallback(() => {
    setRequest(null)
    setBusy(false)
  }, [])

  const run = useCallback(async () => {
    if (!request?.onConfirm) {
      close()
      return
    }
    setBusy(true)
    try {
      await request.onConfirm()
    } finally {
      // Closed either way. A delete that failed has already said so through
      // the page's own toast, and leaving the dialog open reads as if nothing
      // happened at all.
      setRequest(null)
      setBusy(false)
    }
  }, [request, close])

  const confirmDialog = request ? (
    <ConfirmDialog
      title={request.title}
      body={request.body}
      confirmLabel={request.confirmLabel}
      cancelLabel={request.cancelLabel}
      danger={request.danger !== false}
      busy={busy}
      onConfirm={run}
      onClose={close}
    />
  ) : null

  return { confirm, confirmDialog }
}
