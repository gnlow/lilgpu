import {
    GpuWrapper,
    GpuWrapperInfo,
} from "./GpuWrapper.ts"

import { Layout } from "./types.ts"

import tgpu, { TgpuRoot } from "https://esm.sh/typegpu@0.3.2"

import { createCapture } from "jsr:@std/webgpu@0.224.7"
import { copyToBuffer, createPng } from "./denoUtil.ts"

export class DenoGpuWrapper<T extends Layout> extends GpuWrapper<T> {
    outputBuffer
    dimension

    constructor(
        root: TgpuRoot,
        info: GpuWrapperInfo<T> & { width: number, height: number },
        outputBuffer: GPUBuffer,
    ) {
        super(root, info)
        this.outputBuffer = outputBuffer
        this.dimension = {
            width: info.width,
            height: info.height,
        }
    }

    override beforeDrawFinish(commandEncoder: GPUCommandEncoder) {
        copyToBuffer(
            commandEncoder,
            this.getTexture(),
            this.outputBuffer,
            this.dimension,
        )
    }
    async getImage() {
        return await createPng(
            this.outputBuffer,
            this.dimension,
        )
    }
}

export async function initDeno<T extends Layout>
(info: Omit<GpuWrapperInfo<T>, "texture"> & { width: number, height: number }) {
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
