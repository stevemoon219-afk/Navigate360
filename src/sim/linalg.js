// Tiny linear-algebra helpers. We only ever need 3-vectors and 4×4 matrices,
// so plain arrays are clearer than a library.

export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, s) => a.map((v) => v * s);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));
export const normalize = (a) => scale(a, 1 / norm(a));
export const dist = (a, b) => norm(sub(a, b));
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));

export const matMul = (A, B) =>
  A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));

export const matVec = (A, x) => A.map((row) => dot(row, x));

/**
 * Solve A·x = b by Gauss-Jordan elimination with partial pivoting.
 * Returns null if A is (numerically) singular, e.g. satellites in a bad arrangement.
 */
export function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]); // augmented matrix
  for (let col = 0; col < n; col++) {
    // pick the row with the largest value in this column (numerical stability)
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Matrix inverse via solving A·X = I column by column. */
export function inverse(A) {
  const n = A.length;
  const cols = [];
  for (let j = 0; j < n; j++) {
    const e = Array.from({ length: n }, (_, i) => (i === j ? 1 : 0));
    const col = solveLinear(A, e);
    if (!col) return null;
    cols.push(col);
  }
  return transpose(cols);
}
