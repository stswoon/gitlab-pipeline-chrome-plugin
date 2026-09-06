import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { BulkEditor } from './BulkEditor'
import { ParamList } from './ParamList'
import { PopupFooter } from './PopupFooter'
import { ProfileHeader } from './ProfileHeader'
import { usePopupStore } from './store'

export function App() {
  const hydrated = usePopupStore((state) => state.hydrated)
  const view = usePopupStore((state) => state.view)
  const hydrate = usePopupStore((state) => state.hydrate)
  const setView = usePopupStore((state) => state.setView)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (!hydrated) {
    return (
      <main className="flex w-[600px] min-w-[570px] max-w-[630px] flex-col bg-background p-4 text-sm text-muted-foreground">
        Loading…
      </main>
    )
  }

  return (
    <main className="flex max-h-[600px] w-[600px] min-w-[570px] max-w-[630px] flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <ProfileHeader />
        <div
          data-slot="button-group"
          role="tablist"
          aria-label="Editor view"
          className="inline-flex w-fit rounded-lg border border-border p-0.5"
        >
          <Button
            type="button"
            size="sm"
            role="tab"
            aria-selected={view === 'list'}
            variant={view === 'list' ? 'default' : 'ghost'}
            className="rounded-md"
            onClick={() => {
              setView('list')
            }}
          >
            List
          </Button>
          <Button
            type="button"
            size="sm"
            role="tab"
            aria-selected={view === 'bulk'}
            variant={view === 'bulk' ? 'default' : 'ghost'}
            className="rounded-md"
            onClick={() => {
              setView('bulk')
            }}
          >
            Bulk
          </Button>
        </div>
        {view === 'list' ? <ParamList /> : <BulkEditor />}
      </div>
      <div className="p-3 pt-0">
        <PopupFooter />
      </div>
    </main>
  )
}
