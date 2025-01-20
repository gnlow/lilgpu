import {
    tgpu,
    TgpuRoot,
    type Uniform,
} from "./deps.ts"

import {
    AnyData,
    Layout,
} from "./types.ts"

export interface GpuWrapperInfo<T extends Layout> {
    texture: GPUTexture,
    format?: GPUTextureFormat,
    vertShader: string,
    fragShader: string,
    layout?: T,
}

export class GpuWrapper<T extends Layout> {
    root
    texture
    format
    pipeline
    bindGroup
    buffers

    constructor(
        root: TgpuRoot,
        {
            texture,
            format,
            vertShader,
            fragShader,
            layout,
        }: GpuWrapperInfo<T>,
    ) {
        this.root = root
        this.texture = texture
        this.format = format || navigator.gpu.getPreferredCanvasFormat()

        const device = this.root.device

        this.buffers = {} as {
            [K in keyof T]: T[K] extends { uniform: infer D }
                ? ReturnType<typeof root.createBuffer<D extends AnyData ? D : never>> & Uniform
                : never
        }
        Object.entries(layout || {})
            .forEach(([k, v]) => {
                if ("uniform" in v!) {
                    (this.buffers[k] as unknown) =
                        root.createBuffer(v.uniform)
                            .$usage("uniform")
                }
            })

        const bgLayout = tgpu.bindGroupLayout<T>(layout || {} as T)
        this.bindGroup = root.createBindGroup(
            bgLayout,
            this.buffers as any,
        )

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
            }
        })
    }
    draw(...params: Parameters<GPURenderPassEncoder["draw"]>) {
        const textureView = this.texture.createView()
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

        this.root.device.queue.submit([commandEncoder.finish()])
    }
    
    static async init<T extends Layout>(info: GpuWrapperInfo<T>) {
        return new GpuWrapper(
            await tgpu.init(),
            info,
        )
    }
}
