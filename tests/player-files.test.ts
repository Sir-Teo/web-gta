import {expect,test} from 'vitest';
import {readPlayerFiles,playerFilesForOutfit} from '../src/assets/readPlayerFiles';
test('player file selection reports missing inputs and rejects case-insensitive duplicates',async()=>{
 await expect(readPlayerFiles([],'normal','classic')).rejects.toThrow('1–64 files');
 await expect(readPlayerFiles([new File([''],'player.dff')],'normal','classic')).rejects.toThrow('torso.dff');
 await expect(readPlayerFiles([new File([''],'player.dff'),new File([''],'PLAYER.DFF')],'normal','classic')).rejects.toThrow('Duplicate player file');
});
test('required player filenames match outfit dependencies and reject unsupported choices',()=>{
 expect(playerFilesForOutfit('classic')).toContain('sneakerbincblk.txd');expect(playerFilesForOutfit('vest')).toContain('vest.dff');expect(playerFilesForOutfit('vest')).not.toContain('jeans.dff');expect(playerFilesForOutfit('bare')).not.toContain('vest.dff');
 expect(()=>playerFilesForOutfit('unknown' as any)).toThrow('Unknown player outfit');
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('local File assembly reads the actual body and clothing inputs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const files=await Promise.all(playerFilesForOutfit('classic').map(async name=>new File([await readFile(`${process.env.GTA_CONTENT_DIR}/player/${name}`)],name.toUpperCase())));
 const body=await readPlayerFiles(files,'fat','classic');expect(body.playerBody).toBe(true);expect(body.model.atomics).toHaveLength(5);expect(body.textures.map(t=>t.name)).toEqual(['torso_fat','face','legs_fat','foot']);expect(body.sourceFiles).toEqual(playerFilesForOutfit('classic'));
});
