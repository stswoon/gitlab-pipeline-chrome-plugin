import type { Param } from '../shared/query';
import { setBranchIfNeeded } from './branch';
import { isSkippedFillKey } from './fill-rules';
import { addVariable, findVariableRow, isFileVariableRow, setVariableRow } from './variables';
import { applyInputWidget, findInputRow } from './widgets';

export async function fillForm(doc: Document, params: Param[]): Promise<void> {
  const branch = params.find((param) => param.key === '_branch');
  if (branch) {
    await setBranchIfNeeded(doc, branch.value);
  }

  for (const { key, value } of params) {
    try {
      if (key === '_branch' || isSkippedFillKey(key)) {
        continue;
      }

      const inputRow = findInputRow(doc, key);
      if (inputRow) {
        await applyInputWidget(inputRow, value);
        continue;
      }

      const variableRow = findVariableRow(doc, key);
      if (variableRow) {
        if (isFileVariableRow(variableRow)) {
          continue;
        }
        const ok = await setVariableRow(variableRow, key, value);
        if (!ok) {
          continue;
        }
        continue;
      }

      try {
        await addVariable(doc, key, value);
      } catch {
        continue;
      }
    } catch {
      continue;
    }
  }
}
