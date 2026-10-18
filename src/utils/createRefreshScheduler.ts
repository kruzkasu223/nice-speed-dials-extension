// Coalesce event bursts, including events arriving during an in-flight refresh.
export const createRefreshScheduler = (
  refresh: () => Promise<void>,
  onError: (error: unknown) => void,
  delay = 50
) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let running = false
  let pauses = 0
  let disposed = false

  const schedule = () => {
    if (disposed || pauses || running || timer !== undefined || !dirty) return
    timer = setTimeout(async () => {
      timer = undefined
      dirty = false
      running = true
      try {
        await refresh()
      } catch (error) {
        onError(error)
      } finally {
        running = false
        schedule()
      }
    }, delay)
  }

  return {
    request() {
      dirty = true
      schedule()
    },
    pause() {
      pauses++
      clearTimeout(timer)
      timer = undefined
    },
    resume() {
      pauses = Math.max(0, pauses - 1)
      schedule()
    },
    dispose() {
      disposed = true
      clearTimeout(timer)
      timer = undefined
    },
  }
}
