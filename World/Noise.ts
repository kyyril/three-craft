
export class Noise {
  private p: number[] = new Array(512);

  constructor(seed: number = 42) {
    const permutation = Array.from({ length: 256 }, (_, i) => i);
    let currentSeed = seed;
    const random = () => {
      const x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }

    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i % 256];
    }
  }

  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  private lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  private grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  perlin2d(x: number, y: number) {
    return this.perlin3d(x, y, 0);
  }

  perlin3d(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const a = this.p[X] + Y, aa = this.p[a] + Z, ab = this.p[a + 1] + Z;
    const b = this.p[X + 1] + Y, ba = this.p[b] + Z, bb = this.p[b + 1] + Z;

    return this.lerp(w, 
      this.lerp(v, 
        this.lerp(u, this.grad(this.p[aa], x, y, z), this.grad(this.p[ba], x - 1, y, z)),
        this.lerp(u, this.grad(this.p[ab], x, y - 1, z), this.grad(this.p[bb], x - 1, y - 1, z))
      ),
      this.lerp(v, 
        this.lerp(u, this.grad(this.p[aa + 1], x, y, z - 1), this.grad(this.p[ba + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.p[ab + 1], x, y - 1, z - 1), this.grad(this.p[bb + 1], x - 1, y - 1, z - 1))
      )
    );
  }
}
