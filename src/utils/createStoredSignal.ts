import { createSignal, onCleanup } from "solid-js"

type StoredItem<T> = {
  getValue: () => Promise<T>
  watch: (callback: (value: T) => void) => () => void
}

// Start independent reads together and tie each subscription to its component.
export const createStoredSignal = <T>(item: StoredItem<T>, fallback: T) => {
  const signal = createSignal<T>(fallback)
  const [, setValue] = signal
  let active = true
  let changed = false
  const update = (value: T) => setValue(() => value ?? fallback)
  const unwatch = item.watch((value) => {
    changed = true
    update(value)
  })
  void item
    .getValue()
    .then((value) => {
      if (active && !changed) update(value)
    })
    .catch(console.error)
  onCleanup(() => {
    active = false
    unwatch()
  })
  return signal
}
