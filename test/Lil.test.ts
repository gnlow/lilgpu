import {
    assertEquals,
    assertIsError,
} from "https://esm.sh/jsr/@std/assert@1.0.13"

import {
    Lil,
    d,

    vertex,
    fragment,
    compute,

    uniform,
    storage,
} from "../deno.ts"

Deno.test("read storage (Deno specific)", async () => {
    class Test extends Lil {
        @storage(d.arrayOf(d.u32, 10), "mutable")
        accessor data = [0]

        @compute
        main = ` `
    }

    const test = new Test()
    const g = await test.init()
    
    try {
        await g.buffers.data.read()
    } catch (e) {
        // It seems Deno doesn't support `read`
        assertIsError(e)
        assertEquals(e.message, "This operation is currently not supported")
    }
})

Deno.test("buffers", async () => {
    class Test extends Lil {
        @storage(d.arrayOf(d.u32, 10), "mutable")
        accessor data = [0]

        @compute
        main = `
            @compute
            @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) id: vec3u) {
                data[id.x] = id.x;
            }
        `
    }
    const test = new Test()
    const g = await test.init()

    g.compute(10)
})
