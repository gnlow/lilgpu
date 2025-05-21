import { Layout } from "./types.ts"
import { AnyWgslData } from "./deps.ts"
import { initCanvas } from "./GpuWrapper.ts";

const accessorDecorator =
<
    Args extends unknown[],
    This,
    Return,
    _Ctx = ClassAccessorDecoratorContext<This, Return>
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
    }
}

export const uniform = 
<T extends AnyWgslData, C extends Lil>
(type: T) =>
accessorDecorator(
    (lil: C) =>
    (type: T) => ({
        getV: (v: T["~repr"]) => v,
        setV: (v, { name }) => {
            lil.update(name as any, v as any)
        },
        init: (v, { name }) => {
            lil.layout[name as string] = { uniform: type }
        },
    })
)(type)

type UpdateListener<Class> = <T extends keyof Class>(name: T, value: Class[T]) => void

export abstract class Lil {
    abstract vertShader: string
    abstract fragShader: string
    layout: Layout = {}

    updateListeners: UpdateListener<this>[] = []
    onUpdate(f: UpdateListener<this>) {
        this.updateListeners.push(f)
    }

    update<T extends keyof this>(name: T, value: this[T]) {
        this.updateListeners.forEach(f => f(name, value))
    }

    async initCanvas(canvas: HTMLCanvasElement) {
        const wrapper = await initCanvas({
            ...this,
            canvas,
        })
        this.onUpdate((name, value) => {
            (wrapper.buffers as any)[name].write(value)
        })

        const that = this as Record<string, any>

        return new Proxy(wrapper, {
            get(obj, prop) {
                return prop in obj
                    ? Reflect.get(obj, prop)
                    : that[prop as string]
            },
            set(obj, prop, newValue) {
                return prop in obj
                    ? Reflect.set(obj, prop, newValue)
                    : !!(that[prop as string] = newValue)
            }
        })
    }
}
