import {
    AnyWgslData,
    Infer,
    TgpuLayoutEntry,
    TgpuLayoutStorage,
} from "./deps.ts"
import { GpuWrapper } from "./GpuWrapper.ts"

const accessorDecorator =
<
    Args extends unknown[],
    This,
    Return,
    _Ctx extends ClassAccessorDecoratorContext<This, Return>,
>
(f: (that: This) => (...args: Args) => {
    getV(v: Return, ctx: _Ctx): Return,
    setV(v: Return, ctx: _Ctx): Return,
    init?(v: Return, ctx: _Ctx): void,
}) =>
(...args: Args) => function (
    this: void,
    { get, set }: ClassAccessorDecoratorTarget<This, Return>,
    ctx: _Ctx,
) {
    return {
        get(this: This) {
            return f(this)(...args).getV(get.call(this), ctx)
        },
        set(this: This, newValue: Return) {
            set.call(this, f(this)(...args).setV(newValue, ctx))
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
        getV: (v: Infer<T>) => v,
        setV: (v, { name }) => {
            lil.update(
                name as This["__t_keys"],
                v as This[This["__t_keys"]],
            )
            return v
        },
        init: (_, { name }) => {
            lil.layout[name as This["__t_keys"]] = f(...args)
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

export abstract class Lil {
    vertShader?: string
    fragShader?: string
    compShader?: string
    /**
     * Type variable
     */
    __t_keys = "" as keyof Omit<this, keyof Lil>

    layout = {} as Record<this["__t_keys"], TgpuLayoutEntry>

    updateListeners: (
        <K extends this["__t_keys"]>
        (name: K, value: this[K]) => void
    )[] = []
    onUpdate(f: typeof this.updateListeners[0]) {
        this.updateListeners.push(f)
    }

    update(name: this["__t_keys"], value: this[typeof name]) {
        this.updateListeners.forEach(f => f(name, value))
    }

    initWrapper(wrapper: GpuWrapper<this["layout"]>) {
        this.onUpdate((name, value) => {
            wrapper.buffers[name].write(value)
        })
        keys(this.layout).forEach(name => {
            const value = this[name]
            wrapper.buffers[name].write(value)
        })
    }
}
