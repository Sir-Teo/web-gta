// Equations transcribed independently from gta-reversed CEntity (0076f901).
// clang++ -ffp-contract=off native-tree-wind-reference.cpp -o /tmp/tree-wind
using uint32_t=unsigned int;
using uint16_t=unsigned short;
extern "C" float sinf(float);
extern "C" int printf(const char*,...);
extern "C" int puts(const char*);
float offsets[]={1,.5,.2,.7,.4,1,.5,.3,.2,.1,.7,.6,.3,1,.5,.2};
float reference(uint32_t time,float wind,uint16_t seed,uint32_t address,bool palm){
 float result;
 if(wind>=.5f){
  auto i=(((seed+time*8)&0xffff)/4096)%16;auto j=(i+1)%16;
  float contribution=float((seed+time*8)%4096)/4096.f;
  result=(1.f-contribution)*offsets[i];result+=1.f+contribution*offsets[j];result*=wind;result*=.015f;
 }else{
  result=sinf(float((address+time)&0xfff)*(6.28f/4096.f))*.005f;
  if(wind>=.2f)result*=1.6f;
 }
 if(palm)result+=wind*.03f;
 return result;
}
int main(){
 uint32_t times[]={0,1024,4095,4096,536870912,4294967295u};
 float winds[]={0,.199999f,.2f,.499999f,.5f,1};
 uint16_t seeds[]={0,65535};uint32_t addresses[]={0,1,0xffffff80u};
 puts("[");bool first=true;
 for(auto t:times)for(auto w:winds)for(auto s:seeds)for(auto a:addresses)for(int palm=0;palm<2;++palm){
  if(!first)puts(",");first=false;
  auto bend=reference(t,w,s,a,palm);
  printf("[%u,%.9g,%u,%u,%s,%.9g,%.9g]",t,w,s,a,palm?"true":"false",bend*-.6f,bend*.8f);
 }puts("\n]");
}
