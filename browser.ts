export * from "./common.ts"

export * from "./src/GpuWrapper.ts"

import { Lil as Lil_ } from "./src/Lil.ts"
import { initCanvas } from "./src/GpuWrapper.ts"

export abstract class Lil extends Lil_ {
    async init(canvas: HTMLCanvasElement) {
        const wrapper = await initCanvas({
            ...this,
            canvas,
        })
        this.initWrapper(wrapper)

        return wrapper
    }
}
