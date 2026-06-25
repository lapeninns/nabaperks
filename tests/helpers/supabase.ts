import { vi } from "vitest"

type SupabaseResponse<T = unknown> = {
  data?: T
  error?: { message: string; code?: string } | null
  count?: number | null
}

export type QueryCall = {
  table: string
  method: string
  args: unknown[]
}

export type RpcCall = {
  name: string
  params: Record<string, unknown> | undefined
}

type MockConfig = {
  from?: Record<string, SupabaseResponse[]>
  rpc?: Record<string, SupabaseResponse[]>
  auth?: Record<string, unknown>
}

export function createSupabaseMock(config: MockConfig = {}) {
  const fromQueues = new Map(
    Object.entries(config.from ?? {}).map(([table, responses]) => [
      table,
      [...responses],
    ])
  )
  const rpcQueues = new Map(
    Object.entries(config.rpc ?? {}).map(([name, responses]) => [
      name,
      [...responses],
    ])
  )
  const queryCalls: QueryCall[] = []
  const rpcCalls: RpcCall[] = []

  function nextFromResponse(table: string) {
    return (
      fromQueues.get(table)?.shift() ?? { data: null, error: null, count: 0 }
    )
  }

  function query(table: string) {
    const api = {
      select: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "select", args })
        return api
      }),
      eq: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "eq", args })
        return api
      }),
      gt: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "gt", args })
        return api
      }),
      gte: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "gte", args })
        return api
      }),
      lt: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "lt", args })
        return api
      }),
      lte: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "lte", args })
        return api
      }),
      in: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "in", args })
        return api
      }),
      order: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "order", args })
        return api
      }),
      limit: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "limit", args })
        return api
      }),
      maybeSingle: vi.fn(() => {
        queryCalls.push({ table, method: "maybeSingle", args: [] })
        return api
      }),
      single: vi.fn(() => {
        queryCalls.push({ table, method: "single", args: [] })
        return api
      }),
      insert: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "insert", args })
        return api
      }),
      update: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "update", args })
        return api
      }),
      upsert: vi.fn((...args: unknown[]) => {
        queryCalls.push({ table, method: "upsert", args })
        return api
      }),
      then: (
        onFulfilled: (value: SupabaseResponse) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) =>
        Promise.resolve(nextFromResponse(table)).then(onFulfilled, onRejected),
    }

    return api
  }

  const client = {
    auth: config.auth ?? {},
    from: vi.fn((table: string) => query(table)),
    rpc: vi.fn((name: string, params?: Record<string, unknown>) => {
      rpcCalls.push({ name, params })
      const response = rpcQueues.get(name)?.shift() ?? {
        data: null,
        error: null,
      }
      return Promise.resolve(response)
    }),
  }

  return { client, queryCalls, rpcCalls }
}
