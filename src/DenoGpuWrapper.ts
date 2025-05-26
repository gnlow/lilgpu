import {
    GpuWrapper,
    GpuWrapperInfo,
} from "./GpuWrapper.ts"

import { Layout } from "./types.ts"

import tgpu, { TgpuRoot } from "https://esm.sh/typegpu@0.5.7?bundle=false"

import { createCapture } from "jsr:@std/webgpu@0.224.7"
import { copyToBuffer, createPng } from "./denoUtil.ts"

export class DenoGpuWrapper<T extends Layout> extends GpuWrapper<T> {
    outputBuffer
    dimension

    constructor(
        root: TgpuRoot,
        info: GpuWrapperInfo<T> & { width?: number, height?: number },
        outputBuffer: GPUBuffer,
    ) {
        super(root, info)
        this.outputBuffer = outputBuffer
        if (info.width && info.height) this.dimension = {
            width: info.width,
            height: info.height,
        }
    }

    override beforeDrawFinish(commandEncoder: GPUCommandEncoder) {
        if (!this.getTexture || !this.dimension) {
            throw new Error("No texture provided")
        }
        copyToBuffer(
            commandEncoder,
            this.getTexture(),
            this.outputBuffer,
            this.dimension,
        )
    }
    async getImage() {
        if (!this.dimension) {
            throw new Error("No texture provided")
        }
        return await createPng(
            this.outputBuffer,
            this.dimension,
        )
    }
}

export async function initDeno<T extends Layout>
(info: Omit<GpuWrapperInfo<T>, "getTexture"> & { width: number, height: number }) {
    const root = await tgpu.init()
    const { texture, outputBuffer } = createCapture(
        root.device,
        info.width,
        info.height,
    )
    const out = new DenoGpuWrapper(
        root,
        {
            ...info,
            getTexture: () => texture,
            format: "rgba8unorm-srgb",
        },
        outputBuffer,
    )
    return out
}
