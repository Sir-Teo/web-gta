const f=Math.fround,epsilon=2**-24;
/** RenderScene's temporary near-clip adjustment for static/stored shadows.
 * forwardY is the runtime camera direction's vertical component (native Z). */
export function nativeShadowNearClip(near:number,far:number,forwardY:number){
 if(![near,far,forwardY].every(Number.isFinite)||near<=0||far<=near||Math.abs(forwardY)>1.000001)throw new Error('Invalid native shadow depth camera.');
 const n=f(near),end=f(far),down=f(Math.max(0,-forwardY));
 const amount=f(f(f(-1.5*epsilon*down)+2*epsilon)*f(end-n));
 const result=f(n+amount);
 if(!(result>0&&result<end))throw new Error('Native shadow depth clip is outside its frustum.');
 return result;
}
