import test from "node:test";
import assert from "node:assert/strict";
import { signAlbumPhotoUrls } from "./activityAlbumReadUrls.js";
test("677 authorized photos use seven bounded batches and preserve order", async () => {
  const rows = Array.from({length:677}, (_,i)=>({bucket:"private",storage_path:String(i)}));
  const calls=[];
  const urls=await signAlbumPhotoUrls(rows,async(bucket,paths)=>{
    calls.push(paths.length);
    return paths.slice().reverse().map(path=>({path,signedUrl:"signed:"+path}));
  });
  assert.deepEqual(calls,[100,100,100,100,100,100,77]);
  assert.deepEqual(urls,rows.map(r=>"signed:"+r.storage_path));
});
test("missing or failed signatures surface failure rather than an empty album",async()=>{
  await assert.rejects(signAlbumPhotoUrls([{bucket:"a",storage_path:"b"}],async()=>[]),/Incomplete/);
  await assert.rejects(signAlbumPhotoUrls([{bucket:"a",storage_path:"b"}],async()=>[{path:"b",error:"missing"}]),/Unable/);
});
