// deno-lint-ignore-file no-this-alias no-explicit-any
import {
    AnyData,
    Layout,
} from "./types.ts"
import { isWgslData } from "./deps.ts"
import { initCanvas } from "./GpuWrapper.ts"

const uniform =
<T extends AnyData>
(type: T) =>
(
    _: undefined,
    ctx: ClassFieldDecoratorContext<Lil, T["~repr"]>,
) => function(this: Lil, value: T["~repr"]) {
    if (!isWgslData(type)) {
        throw new Error("Not wgsl data")
    }
    this.layout[ctx.name as string] = { uniform: type }

    return value
}

export abstract class Lil {
    abstract vertShader: string
    abstract fragShader: string
    layout: Layout = {}

    async initCanvas(canvas: HTMLCanvasElement) {
        /*
        const wrapper = await initCanvas({
            ...this,
            canvas,
        })
            */
        const wrapper = {}

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

import * as d from "./deps.ts"

class My extends Lil {
    vertShader = ""
    fragShader = ""

    @uniform(d.f32) SEED = 0
}

const my = new My()

const g1 = await my.initCanvas(0 as any)

console.log(g1.SEED)