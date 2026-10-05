/* CAEPedSpeechAudioEntity's pain (gta-reversed Audio/Entities/AEPedSpeechAudioEntity.cpp and PedSpeechAudioEntityLUTs.inc.h):
 * a pain context says a sound of the PAIN_A pack's bank for the voice, picked from gPainSpeechLookup's range. */
/** ePainSpeechVoices, and gPainVoiceToBankLookup: CJ's, the male and the female pain voices' banks, whose 169, 131 and
 * 101 sounds are the table's three columns. */
export const PAIN_VOICE_CARL=0,PAIN_VOICE_MALE=1,PAIN_VOICE_FEMALE=2;
export const PAIN_BANKS=[144,145,146] as const;
/** gPainSpeechLookup (0x8C64B8): per specific pain context (CTX_PAIN_CJ_* 0 to 14, CTX_PAIN_PED_* 15 to 21) the first
 * and last sound for CJ, a male and a female, or none. */
export const PAIN_SPEECH_LOOKUP:readonly (readonly ([number,number]|null)[])[]=[
 [[0,13],null,null],[[14,24],null,null],[[25,33],null,null],[[34,39],null,null],[[40,63],null,null],[[64,78],null,null],
 [[79,86],null,null],[[87,100],null,null],[[101,121],null,null],[[122,127],null,null],[[128,133],null,null],
 [[134,143],null,null],[[144,155],null,null],[[156,162],null,null],[[163,168],null,null],
 [null,[0,24],[0,6]],[null,[25,35],[7,18]],[null,[36,45],[19,35]],[null,[46,87],[36,68]],[null,[88,102],[69,83]],
 [null,[103,119],[84,94]],[null,[120,130],[95,100]],
];
/** The global pain contexts the port says, and gSpeechContextLookup's specific context for a ped (the GEN column)
 * and for CJ (the PLY column), with the context's repeat time. */
export const PAIN_CONTEXTS={
 high:{ped:18,cj:7,repeatMs:2000},low:{ped:18,cj:8,repeatMs:2000},onFire:{ped:19,cj:6,repeatMs:100},
 deathHigh:{ped:16,cj:2,repeatMs:2000},deathLow:{ped:17,cj:2,repeatMs:2000},
} as const;
export type PainContext=keyof typeof PAIN_CONTEXTS;
/** CAEPedSpeechAudioEntity::GetPainVoice: CJ's, else a female one for CIVFEMALE and PROSTITUTE peds, else male. */
export function painVoice(player:boolean,pedType?:string){return player?PAIN_VOICE_CARL:pedType==='CIVFEMALE'||pedType==='PROSTITUTE'?PAIN_VOICE_FEMALE:PAIN_VOICE_MALE;}
/** The bank and sound a pain context says in a voice, or nothing where the table has none. */
export function painSound(context:PainContext,voice:number,random:()=>number){
 const specific=voice===PAIN_VOICE_CARL?PAIN_CONTEXTS[context].cj:PAIN_CONTEXTS[context].ped;
 const range=PAIN_SPEECH_LOOKUP[specific]?.[voice];if(!range)return undefined;
 return {bank:PAIN_BANKS[voice],sound:range[0]+Math.floor(random()*(range[1]-range[0]+1))};
}
