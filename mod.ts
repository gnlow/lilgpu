export * as d from "https://esm.sh/typegpu@0.3.2/data"

import tgpu, {
    TgpuRoot,
    TgpuLayoutEntry,
    Uniform,
} from "https://esm.sh/typegpu@0.3.2"

type AnyData = Parameters<TgpuRoot["createBuffer"]>[0]
type Layout = Record<string, TgpuLayoutEntry | null>

interface GpuWrapperInfo<T extends Layout> {
    $canvas: HTMLCanvasElement,
    vertShader: string,
    fragShader: string,
    layout?: T,
}

export class GpuWrapper<T extends Layout> {
    root
    ctx
    format = navigator.gpu.getPreferredCanvasFormat()
    pipeline
    bindGroup
    buffers

    constructor(
        root: TgpuRoot,
        {
            $canvas,
            vertShader,
            fragShader,
            layout,
        }: GpuWrapperInfo<T>,
    ) {
        this.root = root
        this.ctx = $canvas.getContext("webgpu") as unknown as GPUCanvasContext

        const device = this.root.device
        const format = this.format
        
        this.ctx.configure({
            device,
            format,
            alphaMode: "premultiplied",
        })

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
                targets: [{ format }],
            },
            primitive: {
                topology: "triangle-strip",
            }
        })
    }
    draw() {
        const textureView = this.ctx.getCurrentTexture().createView()
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
        passEncoder.draw(4)
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
