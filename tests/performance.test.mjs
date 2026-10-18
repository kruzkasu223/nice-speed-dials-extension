import assert from "node:assert/strict"
import { test } from "node:test"
import { setTimeout as sleep } from "node:timers/promises"
import { createRoot } from "solid-js"
import { createRefreshScheduler } from "../src/utils/createRefreshScheduler.ts"
import { createStoredSignal } from "../src/utils/createStoredSignal.ts"
import { getGridDimensions } from "../src/utils/getGridDimensions.ts"

const settle = () => sleep(20)

test("a burst of bookmark events needs only one refresh", async () => {
  let calls = 0
  const scheduler = createRefreshScheduler(
    async () => {
      calls++
    },
    assert.fail,
    0
  )
  for (let i = 0; i < 1000; i++) scheduler.request()
  await settle()
  assert.equal(calls, 1)
  scheduler.dispose()
})

test("changes during a refresh produce exactly one follow-up", async () => {
  let calls = 0
  let finish
  const scheduler = createRefreshScheduler(
    () => {
      calls++
      return calls === 1
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Promise.resolve()
    },
    assert.fail,
    0
  )
  scheduler.request()
  await settle()
  for (let i = 0; i < 100; i++) scheduler.request()
  assert.equal(calls, 1)
  finish()
  await settle()
  assert.equal(calls, 2)
  scheduler.dispose()
})

test("nested bulk operations pause refreshes until every operation ends", async () => {
  let calls = 0
  const scheduler = createRefreshScheduler(
    async () => {
      calls++
    },
    assert.fail,
    0
  )
  scheduler.request()
  scheduler.pause()
  scheduler.pause()
  await settle()
  scheduler.resume()
  await settle()
  assert.equal(calls, 0)
  scheduler.resume()
  await settle()
  assert.equal(calls, 1)
  scheduler.dispose()
})

test("failed refreshes recover and disposal cancels pending work", async () => {
  let calls = 0
  const errors = []
  const scheduler = createRefreshScheduler(
    async () => {
      if (++calls === 1) throw new Error("Temporary API failure")
    },
    (error) => errors.push(error),
    0
  )
  scheduler.request()
  await settle()
  scheduler.request()
  await settle()
  assert.equal(calls, 2)
  assert.equal(errors.length, 1)
  scheduler.request()
  scheduler.dispose()
  await settle()
  assert.equal(calls, 2)
})

test("storage changes win over a stale initial read and listeners are cleaned up", async () => {
  let resolveRead,
    notify,
    unwatched = false,
    read,
    dispose
  createRoot((cleanup) => {
    dispose = cleanup
    ;[read] = createStoredSignal(
      {
        getValue: () =>
          new Promise((resolve) => {
            resolveRead = resolve
          }),
        watch: (callback) => {
          notify = callback
          return () => {
            unwatched = true
          }
        },
      },
      false
    )
  })
  notify(true)
  resolveRead(false)
  await Promise.resolve()
  assert.equal(read(), true)
  dispose()
  assert.equal(unwatched, true)
})

test("disposed components ignore pending storage reads; removed values use defaults", async () => {
  let resolveRead, notify, read, dispose
  createRoot((cleanup) => {
    dispose = cleanup
    ;[read] = createStoredSignal(
      {
        getValue: () =>
          new Promise((resolve) => {
            resolveRead = resolve
          }),
        watch: (callback) => {
          notify = callback
          return () => {}
        },
      },
      112
    )
  })
  notify(180)
  notify(null)
  assert.equal(read(), 112)
  dispose()
  resolveRead(200)
  await Promise.resolve()
  assert.equal(read(), 112)
})

test("grid dimensions handle huge collections without allocating a cell matrix", () => {
  assert.deepEqual(getGridDimensions(1e12), { gridWidth: 1e6, gridHeight: 1e6 })
  assert.deepEqual(getGridDimensions(10, 3), { gridWidth: 3, gridHeight: 4 })
  for (const invalid of [undefined, null, 0, -1, NaN, Infinity]) {
    assert.deepEqual(getGridDimensions(0, invalid), {
      gridWidth: 1,
      gridHeight: 1,
    })
  }
})
