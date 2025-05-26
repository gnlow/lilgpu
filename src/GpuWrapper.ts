// deno-lint-ignore-file no-explicit-any
import {
    tgpu,
    TgpuRoot,
    UniformFlag,
    isWgslData,
} from "./deps.ts"

import {
    AnyData,
    Layout,
} from "./types.ts"

export interface GpuWrapperInfo<T extends Layout> {
    getTexture?(): GPUTexture,
    format?: GPUTextureFormat,
    vertShader?: string,
    fragShader?: string,
    layout?: T,
}
export interface GpuWrapperInfo<T extends Layout> {
    getTexture?(): GPUTexture,
    format?: GPUTextureFormat,
    compShader?: string,
    layout?: T,
}

export class GpuWrapper<T extends Layout> {
    root
    getTexture
    format
    pipeline
    bindGroup
    buffers

    constructor(
        root: TgpuRoot,
        {
            getTexture,
            format,
            vertShader,
            fragShader,
            compShader,
            layout,
        }: GpuWrapperInfo<T>,
    ) {
        this.root = root
        this.getTexture = getTexture
        this.format = format || navigator.gpu.getPreferredCanvasFormat()

        const device = this.root.device

        this.buffers = {} as {
            [K in keyof T]: T[K] extends { uniform: infer D }
                ? ReturnType<typeof root.createBuffer<D extends AnyData ? D : never>> & UniformFlag
                : never
        }
        Object.entries(layout || {})
            .forEach(([k, v]) => {
                if ("uniform" in v!) {
                    (this.buffers[k] as unknown) =
                        root.createBuffer(v.uniform)
                            .$usage("uniform")
                } else if ("storage" in v!) {
                    if (!isWgslData(v.storage)) {
                        throw new Error("lilgpu: Runtime-sized buffer is not yet supported")
                    }
                    (this.buffers[k] as unknown) =
                        root.createBuffer(v.storage)
                            .$usage("storage")
                }
            })

        const bgLayout = tgpu.bindGroupLayout<T>(layout || {} as T)
        this.bindGroup = root.createBindGroup(
            bgLayout,
            this.buffers as any,
        )
        if (vertShader && fragShader) {
            this.pipeline = device.createRenderPipeline({
                layout: device.createPipelineLayout({
                    bindGroupLayouts: [root.unwrap(bgLayout)]
                }),
                vertex: {
                    module: device.createShaderModule({
                        code: tgpu.resolve({
                            template: vertShader,
                            externals: {
                                ...bgLayout.bound,
                            },
                        }),
                    }),
                },
                fragment: {
                    module: device.createShaderModule({
                        code: tgpu.resolve({
                            template: fragShader,
                            externals: {
                                ...bgLayout.bound,
                            },
                        }),
                    }),
                    targets: [{ format: this.format }],
                },
                primitive: {
                    topology: "triangle-strip",
                },
            })
        } else if (compShader) {
            this.pipeline = device.createComputePipeline({
                layout: device.createPipelineLayout({
                    bindGroupLayouts: [root.unwrap(bgLayout)]
                }),
                compute: {
                    module: device.createShaderModule({
                        code: tgpu.resolve({
                            template: compShader,
                            externals: {
                                ...bgLayout.bound,
                            },
                        })
                    })
                },
            })
        } else {
            throw new Error("Need shader")
        }
    }
    beforeDrawFinish(_commandEncoder: GPUCommandEncoder) {}
    draw(...params: Parameters<GPURenderPassEncoder["draw"]>) {
        if (!this.getTexture) {
            throw new Error("No texture provided")
        }
        const textureView = this.getTexture().createView()
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: [0, 0, 0, 0],
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

        this.beforeDrawFinish(commandEncoder)

        this.root.device.queue.submit([commandEncoder.finish()])
    }
    compute(x: number, y?: number, z?: number) {
        const encoder = this.root.device.createCommandEncoder()
        const pass = encoder.beginComputePass()
        pass.setPipeline(this.pipeline)
        pass.setBindGroup(0, this.root.unwrap(this.bindGroup))
        pass.dispatchWorkgroups(x, y, z)
        pass.end()

        this.root.device.queue.submit([encoder.finish()])
    }
}

export async function initCanvas<T extends Layout>
(info: Omit<GpuWrapperInfo<T>, "getTexture"> & { canvas?: HTMLCanvasElement }) {
    const root = await tgpu.init()

    if (!info.canvas) {
        return new GpuWrapper(
            root,
            info,
        )
    }
    const ctx = info.canvas.getContext("webgpu") as unknown as GPUCanvasContext

    ctx.configure({
        device: root.device,
        format: info.format || navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: "premultiplied",
    })

    return new GpuWrapper(
        root,
        {
            ...info,
            getTexture: () => ctx.getCurrentTexture(),
        },
    )
}
