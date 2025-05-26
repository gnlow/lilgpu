const WORKGROUP_SIZE = [8, 8]

const shaderCode = `
@compute @workgroup_size(${WORKGROUP_SIZE.join(', ')})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
  if (global_id.x >= u32(firstMatrix.size.x) || global_id.y >= u32(secondMatrix.size.y)) {
    return;
  }

  if (global_id.x + global_id.y == 0u) {
    resultMatrix.size = vec2(firstMatrix.size.x, secondMatrix.size.y);
  }

  let resultCell = vec2(global_id.x, global_id.y);
  var result = 0.0;

  for (var i = 0u; i < u32(firstMatrix.size.y); i = i + 1u) {
    let a = i + resultCell.x * u32(firstMatrix.size.y);
    let b = resultCell.y + i * u32(secondMatrix.size.y);
    result = result + firstMatrix.numbers[a] * secondMatrix.numbers[b];
  }

  let index = resultCell.y + resultCell.x * u32(secondMatrix.size.y);
  resultMatrix.numbers[index] = result;
}
`

import {
    d,
    Lil,
    storage,
    compute,
} from "../../browser.ts"

const MAX_MATRIX_SIZE = 6

const MatrixStruct = d.struct({
    size: d.vec2f,
    numbers: d.arrayOf(d.f32, MAX_MATRIX_SIZE**2),
})

class MatrixMul extends Lil {
    @compute main = shaderCode

    @storage(MatrixStruct, "readonly")
    accessor firstMatrix = {
        size: d.vec2f(3, 4),
        numbers: [
            0, 1, 2, 3,
            4, 5, 6, 7,
            8, 9, 8, 7,
        ],
    }

    @storage(MatrixStruct, "readonly")
    accessor secondMatrix = {
        size: d.vec2f(4, 2),
        numbers: [
            0, 1,
            2, 3,
            4, 5,
            6, 7,
        ],
    }

    @storage(MatrixStruct, "mutable")
    accessor resultMatrix = {
        size: d.vec2f(3, 2),
        numbers: [] as number[],
    } // todo: init without value
}

const matrixMul = new MatrixMul()
const g = await matrixMul.init()

g.compute(
    Math.ceil(matrixMul.firstMatrix.size.x / WORKGROUP_SIZE[0]),
    Math.ceil(matrixMul.secondMatrix.size.y / WORKGROUP_SIZE[1]),
)

const res = await g.buffers.resultMatrix.read()

console.log(res)
