/** Can this browser run the 3D scene at a usable speed? Client-only. */
export function capable3D(): boolean {
  try {
    if (location.search.includes("force3d")) return true; // testing override
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    // software rasterizers (no GPU / hardware acceleration off / remote desktops) can't hold frame rate: show the painted image instead
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}
