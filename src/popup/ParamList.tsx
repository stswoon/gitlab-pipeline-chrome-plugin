import { useState, type DragEvent } from 'react'
import { GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { ParamType, ProfileParam } from '@/shared/types'
import { STATUS } from './status'
import { selectCurrentProfile, usePopupStore } from './store'

const PARAM_TYPES: { value: ParamType; label: string }[] = [
  { value: 'variable', label: 'variable' },
  { value: 'input', label: 'input' },
  { value: 'branch', label: 'branch' },
]

const PARAM_INDEX_MIME = 'application/x-param-index'

function readDragIndex(event: DragEvent): number | null {
  const raw = event.dataTransfer.getData(PARAM_INDEX_MIME) || event.dataTransfer.getData('text/plain')
  if (!raw) {
    return null
  }
  const index = Number(raw)
  return Number.isInteger(index) ? index : null
}

function ParamRow({
  param,
  index,
  branchTaken,
  isDragging,
  isDropTarget,
  dragFromIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  param: ProfileParam
  index: number
  branchTaken: boolean
  isDragging: boolean
  isDropTarget: boolean
  dragFromIndex: number | null
  onDragStart: () => void
  onDragOver: () => void
  onDragEnd: () => void
  onDrop: (fromIndex: number) => void
}) {
  const updateParam = usePopupStore((state) => state.updateParam)
  const removeParam = usePopupStore((state) => state.removeParam)
  const isBranch = param.type === 'branch'
  const disableBranchOption = branchTaken && !isBranch

  return (
    <div
      data-slot="param-row"
      className={cn(
        'flex items-center gap-1.5 rounded-md',
        isDragging && 'opacity-50',
        isDropTarget && 'bg-accent/60 ring-1 ring-ring',
      )}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOver()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const fromIndex = readDragIndex(event) ?? dragFromIndex
        if (fromIndex !== null) {
          onDrop(fromIndex)
        }
      }}
    >
      <span
        draggable
        aria-label="Drag to reorder"
        className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        onDragStart={(event) => {
          event.dataTransfer.setData(PARAM_INDEX_MIME, String(index))
          event.dataTransfer.setData('text/plain', String(index))
          event.dataTransfer.effectAllowed = 'move'
          const row = event.currentTarget.closest('[data-slot="param-row"]')
          if (row instanceof HTMLElement) {
            event.dataTransfer.setDragImage(row, 12, 16)
          }
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >
        <GripVerticalIcon className="size-4" />
      </span>
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
  const moveParam = usePopupStore((state) => state.moveParam)
  const params = current?.params ?? []
  const branchTaken = params.some((param) => param.type === 'branch')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {params.map((param, index) => (
        <ParamRow
          key={param.id}
          param={param}
          index={index}
          branchTaken={branchTaken}
          isDragging={dragIndex === index}
          isDropTarget={overIndex === index && dragIndex !== null && dragIndex !== index}
          dragFromIndex={dragIndex}
          onDragStart={() => {
            setDragIndex(index)
          }}
          onDragOver={() => {
            setOverIndex(index)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
          onDrop={(fromIndex) => {
            moveParam(fromIndex, index)
            setDragIndex(null)
            setOverIndex(null)
          }}
        />
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
