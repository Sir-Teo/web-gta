/** CVehicle::GetVehicleAppearance (PC 0x6D1080, iOS 0x100476ec0): only one of handling's four category bits may match. */
export function nativeVehicleAppearance(modelFlags:number){
 switch(modelFlags&0x0f000000){
  case 0:return 1;
  case 0x01000000:return 2;
  case 0x02000000:return 3;
  case 0x08000000:return 4;
  case 0x04000000:return 5;
  default:return 0;
 }
}
