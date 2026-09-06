import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ParamType, ProfileParam } from '@/shared/types'
import { STATUS } from './status'
import { selectCurrentProfile, usePopupStore } from './store'

const PARAM_TYPES: { value: ParamType; label: string }[] = [
  { value: 'variable', label: 'variable' },
  { value: 'input', label: 'input' },
  { value: 'branch', label: 'branch' },
]

function ParamRow({
  param,
  branchTaken,
}: {
  param: ProfileParam
  branchTaken: boolean
}) {
  const updateParam = usePopupStore((state) => state.updateParam)
  const removeParam = usePopupStore((state) => state.removeParam)
  const isBranch = param.type === 'branch'
  const disableBranchOption = branchTaken && !isBranch

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={param.type}
        onValueChange={(value) => {
          updateParam(param.id, { type: value as ParamType })
        }}
      >
        <SelectTrigger size="sm" className="w-[6.75rem] shrink-0" aria-label="Type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {PARAM_TYPES.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.value === 'branch' && disableBranchOption}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Input
        aria-label="Name"
        placeholder="Name"
        value={isBranch ? 'ref' : param.name}
        disabled={isBranch}
        onChange={(event) => {
          updateParam(param.id, { name: event.target.value })
        }}
      />
      <Input
        aria-label="Value"
        placeholder="Value"
        value={param.value}
        onChange={(event) => {
          updateParam(param.id, { value: event.target.value })
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete parameter"
        onClick={() => {
          removeParam(param.id)
        }}
      >
        <XIcon />
      </Button>
    </div>
  )
}

export function ParamList() {
  const current = usePopupStore(selectCurrentProfile)
  const addParam = usePopupStore((state) => state.addParam)
  const params = current?.params ?? []
  const branchTaken = params.some((param) => param.type === 'branch')

  return (
    <div className="flex flex-col gap-2">
      {params.map((param) => (
        <ParamRow key={param.id} param={param} branchTaken={branchTaken} />
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addParam}>
        <PlusIcon data-icon="inline-start" />
        Add parameter
      </Button>
      {branchTaken ? (
        <p className="text-xs text-muted-foreground">{STATUS.secondBranch}</p>
      ) : null}
    </div>
  )
}
