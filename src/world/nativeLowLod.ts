/** CRenderer::ConstructRenderList, camera LOD preference otherwise fixed at one. */
export function nativeLowLodScale(cameraHeight:number,exterior:boolean,regionalMultiplier=1){
 if(!Number.isFinite(cameraHeight)||!Number.isFinite(regionalMultiplier)||regionalMultiplier<0||regionalMultiplier>4)throw new Error('Invalid low-LOD scale input.');
 const f=Math.fround;
 if(!Number.isFinite(f(cameraHeight)))throw new Error('Low-LOD camera height exceeds float range.');
 const height=f(cameraHeight),t=exterior&&height>80?Math.min(1,f(f(height-80)/170)):0;
 return f(f(f(t*f(f(2.2)-1))+1)*f(regionalMultiplier));
}
