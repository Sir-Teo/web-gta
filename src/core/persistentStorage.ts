/** An installed game asks the browser to keep its storage (navigator.storage.persist): the world it has streamed (up to
 * 617 MB), the app shell and the progress, which a browser otherwise clears first when the device runs short of space.
 * Chrome grants it to an installed app without asking, and Safari to a home-screen one; a game in a browser tab does not
 * ask, as Firefox would put a prompt up. Whether it was opened installed is read at launch, before the game's own
 * fullscreen makes a tab's display mode fullscreen too. */
interface StorageLike {persist?():Promise<boolean>;persisted?():Promise<boolean>}
export function openedInstalled(nav:{standalone?:boolean}=globalThis.navigator as {standalone?:boolean},match=globalThis.matchMedia?.bind(globalThis)){
 return nav?.standalone===true||!!match?.('(display-mode: standalone), (display-mode: fullscreen)').matches;
}
/** Whether the storage is kept: asked once, and only for an installed game. */
export async function keepStorage(storage:StorageLike|undefined,installed:boolean){
 if(!installed||!storage?.persist)return false;
 try{return (await storage.persisted?.())||await storage.persist();}catch{return false;}
}
