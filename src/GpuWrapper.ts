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
    compShader?: string,
    layout?: T,
    topology?: GPUPrimitiveTopology,
}

export class GpuWrapper<T extends Layout> {
    root
    getTexture
    format
    renderPipeline
    computePipeline
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
            topology,
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
            this.renderPipeline = device.createRenderPipeline({
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
                    topology: topology || "triangle-strip",
                },
            })
        }
        if (compShader) {
            this.computePipeline = device.createComputePipeline({
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
        }
    }
    beforeDrawFinish(_commandEncoder: GPUCommandEncoder) {}
    draw(...params: Parameters<GPURenderPassEncoder["draw"]>) {
        if (!this.getTexture) {
            throw new Error("No texture provided")
        }
        if (!this.renderPipeline) {
            throw new Error("No renderPipeline")
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
        passEncoder.setPipeline(this.renderPipeline)
        passEncoder.setBindGroup(0, this.root.unwrap(this.bindGroup))
        passEncoder.draw(...params)
        passEncoder.end()

        this.beforeDrawFinish(commandEncoder)

        this.root.device.queue.submit([commandEncoder.finish()])
    }
    compute(x: number, y?: number, z?: number) {
        if (!this.computePipeline) {
            throw new Error("No computePipeline")
        }
        const encoder = this.root.device.createCommandEncoder()
        const pass = encoder.beginComputePass()
        pass.setPipeline(this.computePipeline)
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
