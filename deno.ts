export * from "./common.ts"

export * from "./src/DenoGpuWrapper.ts"

import { Lil as Lil_ } from "./src/Lil.ts"
import { initDeno } from "./src/DenoGpuWrapper.ts"

export abstract class Lil extends Lil_ {
    async init(width?: number, height?: number) {
        const wrapper = await initDeno<this["layout"]>({
            ...this,
            width,
            height,
        })
        this.initWrapper(wrapper)

        return wrapper
    }
}
