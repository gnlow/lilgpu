// deno-lint-ignore-file no-explicit-any
import {
    AnyWgslData,
    Infer,
    TgpuLayoutEntry,
    TgpuLayoutStorage,
} from "./deps.ts"
import { GpuWrapper, GpuWrapperInfo } from "./GpuWrapper.ts"

const accessorDecorator =
<
    Args extends unknown[],
    This,
    Return,
    _Ctx extends ClassAccessorDecoratorContext<This, Return>,
>
(f: (that: This) => (...args: Args) => {
    getV?(v: Return, ctx: _Ctx): Return,
    setV?(v: Return, ctx: _Ctx): Return,
    init?(v: Return, ctx: _Ctx): void,
}) =>
(...args: Args) => function (
    this: void,
    { get, set }: ClassAccessorDecoratorTarget<This, Return>,
    ctx: _Ctx,
) {
    return {
        get(this: This) {
            return (f(this)(...args).getV || (v => v))(get.call(this), ctx)
        },
        set(this: This, newValue: Return) {
            set.call(this,(f(this)(...args).setV || (v => v))(newValue, ctx))
        },
        init(this: This, value: Return) {
            f(this)(...args).init?.(value, ctx)
            return value
        },
    } as ClassAccessorDecoratorResult<This, Return>
}

const layoutDecorator = 
<Args extends any[], T extends AnyWgslData, This extends Lil>
(f: (...args: Args) => TgpuLayoutEntry) =>
accessorDecorator(
    (lil: This) =>
    (...args: Args) => ({
        setV: (v: Infer<T>, { name }) => {
            lil.update(
                name as any,
                v as any,
            )
            return v
        },
        init: (_, { name }) => {
            lil.layout[name] = f(...args)
        },
    })
)

export const uniform =
<T extends AnyWgslData, This extends Lil>
(type: T) =>
layoutDecorator<[T], T, This>(
    type => ({ uniform: type })
)(type)

export const storage =
<T extends AnyWgslData, This extends Lil>
(type: T, access: TgpuLayoutStorage["access"]) =>
layoutDecorator<[T, typeof access], T, This>(
    (type, access) => ({ storage: type, access })
)(type, access)

export const topology =
<This extends Lil>
(topology: GPUPrimitiveTopology) =>
(
    _: undefined,
    _ctx: ClassFieldDecoratorContext<This>,
) =>
function (this: This) {
    return this.topology = topology
}

export const vertex =
<This extends Lil>
(
    _: undefined,
    _ctx: ClassFieldDecoratorContext<This, string>,
) =>
function (this: This, value: string) {
    return this.vertShader = value
}

export const fragment =
<This extends Lil>
(
    _: undefined,
    _ctx: ClassFieldDecoratorContext<This, string>,
) =>
function (this: This, value: string) {
    return this.fragShader = value
}

export const compute =
<This extends Lil>
(
    _: undefined,
    _ctx: ClassFieldDecoratorContext<This, string>,
) =>
function (this: This, value: string) {
    return this.compShader = value
}

const keys =
<T extends object>(obj: T) =>
    Object.keys(obj) as (keyof T)[]

type Layout_ = Record<string, TgpuLayoutEntry>

type InferRecord
<Layout extends Layout_> = {
    [K in keyof Layout]: Infer<Layout[K]>
}

export abstract class Lil
<Layout extends Layout_ = any>
implements GpuWrapperInfo<Layout> {
    vertShader?: string
    fragShader?: string
    compShader?: string

    layout = {} as Layout
    topology?: GPUPrimitiveTopology

    updateListeners: (
        <K extends keyof Layout>
        (name: K, value: Infer<Layout[K]>) => void
    )[] = []
    onUpdate(f: typeof this.updateListeners[0]) {
        this.updateListeners.push(f)
    }

    update<K extends keyof Layout>
    (name: K, value: Infer<Layout[K]>) {
        this.updateListeners.forEach(f => f(name, value))
    }

    initWrapper(wrapper: GpuWrapper<Layout>) {
        this.onUpdate((name, value) => {
            (wrapper.buffers[name] as any).write(value)
        })
        keys(this.layout).forEach(name => {
            const value = (this as InferRecord<Layout>)[name]
            ;(wrapper.buffers[name].write as any)(value)
        })
    }
}
