// Sky gradient quad and the tilt-shift pass (quarter-res blur mixed in above and below a sharp band).
import * as THREE from 'three';

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, glow: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 top, bottom, glow;
      void main(){ float k = smoothstep(0.0, 1.0, vUv.y);
        vec3 c = mix(bottom, top, k) + glow * exp(-pow((vUv.y - 0.25) * 3.0, 2.0)) * 0.35;
        gl_FragColor = vec4(c, 1.0); }`,
    depthWrite: false, depthTest: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

const quadVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export function makePost(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const W = size.x, H = size.y, qw = Math.ceil(W / 4), qh = Math.ceil(H / 4);
  const opts = { type: THREE.UnsignedByteType };
  const main = new THREE.WebGLRenderTarget(W, H, { ...opts, samples: new URLSearchParams(location.search).has('msaa') ? 4 : 0 });
  const qa = new THREE.WebGLRenderTarget(qw, qh, opts), qb = new THREE.WebGLRenderTarget(qw, qh, opts);
  [qa, qb].forEach(r => { r.texture.minFilter = r.texture.magFilter = THREE.LinearFilter; });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const scene = new THREE.Scene(); scene.add(quad);

  const blur = new THREE.ShaderMaterial({
    uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: quadVS,
    fragmentShader: `varying vec2 vUv; uniform sampler2D src; uniform vec2 dir;
      void main(){ vec4 c = texture2D(src, vUv) * 0.2270;
        c += (texture2D(src, vUv + dir * 1.385) + texture2D(src, vUv - dir * 1.385)) * 0.3162;
        c += (texture2D(src, vUv + dir * 3.231) + texture2D(src, vUv - dir * 3.231)) * 0.0703;
        gl_FragColor = c; }`,
  });
  const comp = new THREE.ShaderMaterial({
    uniforms: { sharp: { value: main.texture }, soft: { value: qb.texture }, focus: { value: 0.45 }, band: { value: 0.12 },
      amount: { value: 1 }, sat: { value: 1.12 } },
    vertexShader: quadVS,
    fragmentShader: `varying vec2 vUv; uniform sampler2D sharp, soft; uniform float focus, band, amount, sat;
      vec3 toSRGB(vec3 c){ return sqrt(max(c, 0.0)); }
      void main(){
        float m = smoothstep(band, band + 0.22, abs(vUv.y - focus)) * amount;
        vec3 c = mix(texture2D(sharp, vUv).rgb, texture2D(soft, vUv).rgb, m);
        c = toSRGB(c);
        float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat);
        vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.35;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam); };

  return {
    comp: comp.uniforms,
    render(world, camera) {
      renderer.setRenderTarget(main); renderer.render(world, camera);
      blur.uniforms.src.value = main.texture; blur.uniforms.dir.value.set(4 / W, 0); pass(blur, qa);
      blur.uniforms.src.value = qa.texture; blur.uniforms.dir.value.set(0, 1 / qh); pass(blur, qb);
      blur.uniforms.src.value = qb.texture; blur.uniforms.dir.value.set(1 / qw, 0); pass(blur, qa);
      blur.uniforms.src.value = qa.texture; blur.uniforms.dir.value.set(0, 1.6 / qh); pass(blur, qb);
      pass(comp, null);
    },
  };
}
