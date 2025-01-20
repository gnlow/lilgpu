import {
    TgpuRoot,
    TgpuLayoutEntry,
} from "./deps.ts"

export type AnyData = Parameters<TgpuRoot["createBuffer"]>[0]
export type Layout = Record<string, TgpuLayoutEntry | null>
