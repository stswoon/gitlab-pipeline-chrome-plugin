import { Textarea } from '@/components/ui/textarea'
import { usePopupStore } from './store'

export function BulkEditor() {
  const bulkDraft = usePopupStore((state) => state.bulkDraft)
  const status = usePopupStore((state) => state.status)
  const setBulkDraft = usePopupStore((state) => state.setBulkDraft)
  const invalid = status?.tone === 'error'

  return (
    <Textarea
      aria-label="Bulk query"
      aria-invalid={invalid || undefined}
      className="min-h-40 font-mono text-sm"
      placeholder="ref=test&var[VERSION]=1.2.0&input[email]=user@test.com"
      value={bulkDraft}
      onChange={(event) => {
        setBulkDraft(event.target.value)
      }}
    />
  )
}
