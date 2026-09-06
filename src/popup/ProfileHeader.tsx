import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STATUS } from './status'
import { selectCurrentProfile, usePopupStore } from './store'

export function ProfileHeader() {
  const profiles = usePopupStore((state) => state.profiles)
  const currentProfileId = usePopupStore((state) => state.currentProfileId)
  const selectProfile = usePopupStore((state) => state.selectProfile)
  const addProfile = usePopupStore((state) => state.addProfile)
  const renameProfile = usePopupStore((state) => state.renameProfile)
  const deleteCurrentProfile = usePopupStore((state) => state.deleteCurrentProfile)
  const current = usePopupStore(selectCurrentProfile)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isLastProfile = profiles.length <= 1

  const openRename = () => {
    setRenameValue(current?.name ?? '')
    setRenameOpen(true)
  }

  const saveRename = () => {
    if (renameProfile(renameValue)) {
      setRenameOpen(false)
    }
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
      {isLastProfile ? (
        <p className="text-xs text-muted-foreground">{STATUS.keepOneProfile}</p>
      ) : null}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename profile</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
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
    </div>
  )
}
