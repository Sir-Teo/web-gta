using uint32_t=unsigned int;
using uint16_t=unsigned short;
extern "C" float sinf(float);
extern "C" int printf(const char*,...);
extern "C" int puts(const char*);
float offsets[]={1,.5,.2,.7,.4,1,.5,.3,.2,.1,.7,.6,.3,1,.5,.2};
float reference(uint32_t time,float wind,uint16_t seed){
 if(wind>=.5f){
  auto i=(((seed+time*8)&0xffff)/4096)%16;auto j=(i+1)%16;
  float contribution=float((seed+time*8)%4096)/4096.f;
  auto result=(1.f-contribution)*offsets[i];result+=1.f+contribution*offsets[j];result*=wind;result*=.015f;return result;
 }
 return sinf((6.28f/4096.f)*float(time%4096))/(wind>=.2f?125.f:200.f);
}
int main(){
 uint32_t times[]={0,1,512,1024,2048,4095,4096,8191,8192,536870911,536870912,4294967295u};
 float winds[]={0,.199999f,.2f,.499999f,.5f,1};uint16_t seeds[]={0,1,4095,65535};
 puts("[");bool first=true;
 for(auto t:times)for(auto w:winds)for(auto s:seeds){if(!first)puts(",");first=false;printf("[%u,%.9g,%u,%.9g]",t,w,s,reference(t,w,s));}puts("\n]");
}
