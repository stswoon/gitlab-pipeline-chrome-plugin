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
      <main className="flex w-[400px] min-w-[380px] max-w-[420px] flex-col bg-background p-4 text-sm text-muted-foreground">
        Loading…
      </main>
    )
  }

  return (
    <main className="flex max-h-[600px] w-[400px] min-w-[380px] max-w-[420px] flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <ProfileHeader />
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => {
              setView('list')
            }}
          >
            List
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === 'bulk' ? 'default' : 'outline'}
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
