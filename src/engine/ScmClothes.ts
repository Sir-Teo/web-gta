import {requireAsset} from '../assets/binary';
import {nativeUppercaseKey} from './nativeKeyGen';
/* CPedClothesDesc and the part of CClothes it needs, pinned gta-reversed ead3051
 * (`PedClothesDesc.cpp`'s `SetTextureAndModel` 0x5A8080 and `Clothes.cpp`'s `GetTextureDependency` 0x5A7EA0 and
 * `GetDependentTexture` 0x5A7F30, all reversed): what the player is wearing, as a key per texture part and a
 * key per model part. Drawing it belongs to a host; this is what the script chooses. */
/** eClothesTexturePart, up to CLOTHES_TEXTURE_TOTAL. Stomach and lower back share the one slot, as the enum
 * gives them both eleven. */
export const CLOTHES_TEXTURE={
 torso:0,head:1,legs:2,shoes:3,lowerLeftArm:4,upperLeftArm:5,upperRightArm:6,lowerRightArm:7,
 backTop:8,leftChest:9,rightChest:10,stomach:11,upperBack:12,necklace:13,bracelet:14,glasses:15,hats:16,
 special:17,
} as const;
export const CLOTHES_TEXTURE_TOTAL=18;
/** eClothesModelPart. */
export const CLOTHES_MODEL={
 torso:0,head:1,hands:2,legs:3,shoes:4,necklace:5,bracelet:6,glasses:7,hats:8,special:9,
} as const;
export const CLOTHES_MODEL_UNAVAILABLE=10,CLOTHES_MODEL_TOTAL=10;
/** CClothes::GetTextureDependency: the model part a texture part dresses, where there is one. */
export function textureDependency(texturePart:number){
 switch(texturePart){
  case CLOTHES_TEXTURE.torso:return CLOTHES_MODEL.torso;
  case CLOTHES_TEXTURE.head:return CLOTHES_MODEL.head;
  case CLOTHES_TEXTURE.legs:return CLOTHES_MODEL.legs;
  case CLOTHES_TEXTURE.shoes:return CLOTHES_MODEL.shoes;
  case CLOTHES_TEXTURE.necklace:return CLOTHES_MODEL.necklace;
  case CLOTHES_TEXTURE.bracelet:return CLOTHES_MODEL.bracelet;
  case CLOTHES_TEXTURE.glasses:return CLOTHES_MODEL.glasses;
  case CLOTHES_TEXTURE.hats:return CLOTHES_MODEL.hats;
  case CLOTHES_TEXTURE.special:return CLOTHES_MODEL.special;
  default:return CLOTHES_MODEL_UNAVAILABLE;
 }
}
/** CClothes::GetDependentTexture, the same table read the other way. */
export function dependentTexture(modelPart:number){
 const found=Object.values(CLOTHES_TEXTURE).find(texturePart=>textureDependency(texturePart)===modelPart);
 return found===undefined?CLOTHES_TEXTURE_TOTAL:found;
}
export class ScmClothes {
 /** m_anTextureKeys and m_anModelKeys, which CClothes::Init leaves at nothing. */
 readonly textureKeys=new Uint32Array(CLOTHES_TEXTURE_TOTAL);
 readonly modelKeys=new Uint32Array(CLOTHES_MODEL_TOTAL);
 /** CPedClothesDesc::SetTextureAndModel by name: the texture key goes to the part the script names, and the
  * model key only where that part dresses a model part. */
 setTextureAndModel(texture:string,model:string,texturePart:number){
  requireAsset(Number.isInteger(texturePart)&&texturePart>=0&&texturePart<CLOTHES_TEXTURE_TOTAL,'Clothes texture part out of range.');
  this.textureKeys[texturePart]=nativeUppercaseKey(texture);
  const modelPart=textureDependency(texturePart);
  if(modelPart!==CLOTHES_MODEL_UNAVAILABLE)this.modelKeys[modelPart]=nativeUppercaseKey(model);
 }
 /** CClothes::Init for the player's own description. */
 init(){this.textureKeys.fill(0);this.modelKeys.fill(0);}
 /** How many parts the script has dressed, for a host that wants to know there is anything to draw. */
 get dressedParts(){return this.textureKeys.reduce((total,key)=>total+(key?1:0),0);}
}
