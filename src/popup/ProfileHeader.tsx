import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StorageShape } from '@/shared/types'
import { STATUS } from './status'
import { parseImportedStorage, selectCurrentProfile, usePopupStore } from './store'

export function ProfileHeader() {
  const profiles = usePopupStore((state) => state.profiles)
  const currentProfileId = usePopupStore((state) => state.currentProfileId)
  const busy = usePopupStore((state) => state.busy)
  const selectProfile = usePopupStore((state) => state.selectProfile)
  const addProfile = usePopupStore((state) => state.addProfile)
  const renameProfile = usePopupStore((state) => state.renameProfile)
  const deleteCurrentProfile = usePopupStore((state) => state.deleteCurrentProfile)
  const saveProfilesJson = usePopupStore((state) => state.saveProfilesJson)
  const replaceAllProfiles = usePopupStore((state) => state.replaceAllProfiles)
  const rejectImportedFile = usePopupStore((state) => state.rejectImportedFile)
  const view = usePopupStore((state) => state.view)
  const setView = usePopupStore((state) => state.setView)
  const current = usePopupStore(selectCurrentProfile)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<StorageShape | null>(null)

  const isLastProfile = profiles.length <= 1
  const actionsDisabled = busy !== 'idle'

  const openRename = () => {
    setRenameValue(current?.name ?? '')
    setRenameOpen(true)
  }

  const saveRename = () => {
    if (renameProfile(renameValue)) {
      setRenameOpen(false)
    }
  }

  const onImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    void file
      .text()
      .then((text) => {
        let raw: unknown
        try {
          raw = JSON.parse(text)
        } catch {
          rejectImportedFile()
          return
        }
        const shape = parseImportedStorage(raw)
        if (!shape) {
          rejectImportedFile()
          return
        }
        setPendingImport(shape)
        setReplaceOpen(true)
      })
      .catch(() => {
        rejectImportedFile()
      })
  }

  const confirmReplace = () => {
    if (!pendingImport) {
      return
    }
    replaceAllProfiles(pendingImport)
    setPendingImport(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={currentProfileId} onValueChange={selectProfile}>
          <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Profile">
            <SelectValue placeholder="Profile" />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectGroup>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={addProfile}>
          Add
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={openRename}>
          Rename
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLastProfile}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-nowrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={actionsDisabled}
          onClick={saveProfilesJson}
        >
          Save JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={actionsDisabled}
          onClick={() => {
            fileInputRef.current?.click()
          }}
        >
          Load JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onImportFile}
        />
        <div
          data-slot="button-group"
          role="tablist"
          aria-label="Editor view"
          className="ml-auto inline-flex w-fit rounded-lg border border-border p-0.5"
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
      </div>
      {isLastProfile ? (
        <p className="text-xs text-muted-foreground">{STATUS.keepOneProfile}</p>
      ) : null}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename profile</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input
              id="profile-name"
              aria-label="Profile name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveRename()
                }
              }}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={renameValue.trim() === ''}
              onClick={saveRename}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete profile?</AlertDialogTitle>
            <AlertDialogDescription>
              {current
                ? `Delete "${current.name}" and its parameters.`
                : 'Delete this profile and its parameters.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                deleteCurrentProfile()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={replaceOpen}
        onOpenChange={(open) => {
          setReplaceOpen(open)
          if (!open) {
            setPendingImport(null)
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all profiles?</AlertDialogTitle>
            <AlertDialogDescription>
              Current profiles will be replaced by the file contents. Cancel leaves
              everything as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmReplace}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
