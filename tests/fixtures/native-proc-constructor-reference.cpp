// Independent AddObjects -> CEntity constructor -> AddObject sample trace.
// clang++ -ffp-contract=off native-proc-constructor-reference.cpp -o /tmp/proc-seeds
extern "C" int printf(const char*,...);
extern "C" int puts(const char*);
unsigned state;
unsigned next(){state=state*214013u+2531011u;return (state>>16)&32767u;}
float unit(){return float(next())*(1.f/32767.f);}
float lerp(float a,float b,float t){return b*t+a*(1.f-t);}
int main(){
 puts("[");bool first=true;
 for(int failFirst=0;failFirst<2;++failFirst){
  state=1128;
  for(int attempt=0;attempt<2;++attempt){
   float u=unit(),v=u*unit();
   if(failFirst&&attempt==0)continue;
   unsigned seed=next();
   float xy=lerp(1,2,unit()),z=lerp(1,3,unit()),rotation=unit(),offset=2.f*unit();
   if(!first)puts(",");first=false;
   printf("[%d,%d,%u,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g]",failFirst,attempt,seed,85.f+4.f*v,4.f*u-4.f*v,offset+1.f,xy,z,rotation,offset);
  }
 }puts("\n]");
}
