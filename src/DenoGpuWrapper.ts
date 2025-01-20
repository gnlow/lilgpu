import {
    GpuWrapper,
    GpuWrapperInfo,
    Layout, 
} from "../mod.ts"

import tgpu, { TgpuRoot } from "https://esm.sh/typegpu@0.3.2"

import { createCapture } from "jsr:@std/webgpu@0.224.7"
import { copyToBuffer, createPng } from "./denoUtil.ts"

export class DenoGpuWrapper<T extends Layout> extends GpuWrapper<T> {
    outputBuffer

    constructor(
        root: TgpuRoot,
        info: GpuWrapperInfo<T>,
        outputBuffer: GPUBuffer,
    ) {
        super(root, info)
        this.outputBuffer = outputBuffer
    }

    override draw(...params: Parameters<GPURenderPassEncoder["draw"]>) {
        const textureView = this.texture.createView()
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: [0, 1, 0, 1],
                    loadOp: "clear",
                    storeOp: "store",
                }
            ]
        }

        const commandEncoder = this.root.device.createCommandEncoder()
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
        passEncoder.setPipeline(this.pipeline)
        passEncoder.setBindGroup(0, this.root.unwrap(this.bindGroup))
        passEncoder.draw(...params)
        passEncoder.end()

        copyToBuffer(
            commandEncoder,
            this.texture,
            this.outputBuffer,
            { width: 300, height: 300 },
        )

        this.root.device.queue.submit([commandEncoder.finish()])
    }

    static override async init<T extends Layout>(info: Omit<GpuWrapperInfo<T>, "texture">) {
        const root = await tgpu.init()
        const { texture, outputBuffer } = createCapture(
            root.device,
            300,
            300,
        )
        const out = new DenoGpuWrapper(
            root,
            {
                ...info,
                texture,
                format: "rgba8unorm-srgb",
            },
            outputBuffer,
        )
        return out
    }
    async getImage() {
        return await createPng(this.outputBuffer, {
            width: 300, height: 300,
        })
    }
}
