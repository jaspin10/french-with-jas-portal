import { createClient } from '@supabase/supabase-js'

const client = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

let readOnlyMode = false

export function setReadOnlyMode(flag) {
  readOnlyMode = !!flag
}

const BLOCKED = ['insert', 'update', 'upsert', 'delete']

function blockedResult() {
  const err = { message: 'Read-only view: writes are disabled while viewing as a student.' }
  const res = Promise.resolve({ data: null, error: err })
  res.select = function () { return blockedResult() }
  res.eq = function () { return blockedResult() }
  res.match = function () { return blockedResult() }
  res.single = function () { return blockedResult() }
  res.maybeSingle = function () { return blockedResult() }
  return res
}

function wrapBuilder(builder) {
  return new Proxy(builder, {
    get: function (target, prop) {
      if (readOnlyMode && BLOCKED.indexOf(prop) !== -1) {
        return function () { return blockedResult() }
      }
      const value = target[prop]
      if (typeof value === 'function') {
        return value.bind(target)
      }
      return value
    }
  })
}

function wrapStorageBucket(bucket) {
  return new Proxy(bucket, {
    get: function (target, prop) {
      if (readOnlyMode && (prop === 'upload' || prop === 'remove' || prop === 'update' || prop === 'move')) {
        return function () {
          return Promise.resolve({
            data: null,
            error: { message: 'Read-only view: uploads are disabled while viewing as a student.' }
          })
        }
      }
      const value = target[prop]
      if (typeof value === 'function') {
        return value.bind(target)
      }
      return value
    }
  })
}

export const supabase = new Proxy(client, {
  get: function (target, prop) {
    if (prop === 'from') {
      return function (table) {
        return wrapBuilder(target.from(table))
      }
    }
    if (prop === 'storage') {
      return {
        from: function (bucket) {
          return wrapStorageBucket(target.storage.from(bucket))
        }
      }
    }
    const value = target[prop]
    if (typeof value === 'function') {
      return value.bind(target)
    }
    return value
  }
})