import {
    Lil,
    d,
    vertex,
    fragment,
} from "../../browser.ts"

class HelloTriangle extends Lil {
    @vertex v = `
        @vertex
        fn vs_main(@builtin(vertex_index) in_vertex_index: u32) -> @builtin(position) vec4<f32> {
            let x = f32(i32(in_vertex_index) - 1);
            let y = f32(i32(in_vertex_index & 1u) * 2 - 1);
            return vec4<f32>(x, y, 0.0, 1.0);
        }
    `
    @fragment f = `
        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0);
        }
    `
}
const helloTriangle = new HelloTriangle()
const g = await helloTriangle.init(document.querySelector("canvas")!)

g.draw(3)
