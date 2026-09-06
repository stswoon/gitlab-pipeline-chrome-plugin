import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePopupStore } from './store'

export function PopupFooter() {
  const status = usePopupStore((state) => state.status)
  const busy = usePopupStore((state) => state.busy)
  const applyToTab = usePopupStore((state) => state.applyToTab)
  const readFromPage = usePopupStore((state) => state.readFromPage)

  return (
    <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background pt-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={busy !== 'idle'}
          onClick={() => {
            void readFromPage()
          }}
        >
          Read from page
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={busy !== 'idle'}
          onClick={() => {
            void applyToTab()
          }}
        >
          Apply
        </Button>
      </div>
      {status ? (
        <p
          role="status"
          className={cn(
            'text-xs',
            status.tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  )
}
