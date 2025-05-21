# lilgpu
Lil wrapper to toy with WebGPU

## Usage
See [examples](/example/).

### Browser
```js
import { initCanvas, d } from "https://esm.sh/gh/gnlow/lilgpu/browser.ts"

const g = await initCanvas({
    vertShader: `
        @vertex
        fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> @builtin(position) vec4<f32> {
            let x = f32(i32(in_vertex_index) - 1);
            let y = f32(i32(in_vertex_index & 1u) * 2 - 1);
            return vec4<f32>(x, y, 0.0, 1.0);
        }
    `,
    fragShader: `
        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0);
        }
    `,
    canvas: document.querySelector("canvas"),
})

g.draw(3)
```

### Deno
```ts
import { initDeno } from "https://esm.sh/gh/gnlow/lilgpu/deno.ts"

const g = await initDeno({
    vertShader: `
        @vertex
        fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> @builtin(position) vec4<f32> {
            let x = f32(i32(in_vertex_index) - 1);
            let y = f32(i32(in_vertex_index & 1u) * 2 - 1);
            return vec4<f32>(x, y, 0.0, 1.0);
        }
    `,
    fragShader: `
        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0);
        }
    `,
    width: 200,
    height: 200,
})

g.draw(3)

await Deno.writeFile("./triangle.png", await g.getImage())
```

#### Jupyter
```ts
await g.getImage() // Uint8Array
```


##

```ts
class App extends Lil {
    vertShader = ""
    fragShader = ""

    @uniform(d.f32) SEED = 0
    @uniform(d.f32) POW = 1.1
}

const app = new App()

const g1 = await app.initCanvas(
    document.querySelector("canvas")
)

app.seed = 2

const g2 = await app.initDeno({
    width: 200,
    height: 200,
})
```