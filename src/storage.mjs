// Local equivalents of the site's D1 database and R2 file storage.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const dir=resolve(process.env.STUDY_DATA_DIR || '.data');
const files=join(dir,'files');
mkdirSync(files,{recursive:true});
const db=new DatabaseSync(join(dir,'study.sqlite'));
db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8').replace('CREATE TABLE','CREATE TABLE IF NOT EXISTS'));
const pathFor=key=>join(files,createHash('sha256').update(key).digest('hex'));
export const env={
  DB:{prepare(sql){
    const stmt=db.prepare(sql);
    return {bind(...args){return {
      async first(){return stmt.get(...args)??null},
      async all(){return {results:stmt.all(...args)}},
      async run(){return {meta:stmt.run(...args)}},
    }}};
  }},
  BUCKET:{
    async put(key,data,options){
      const name=pathFor(key);
      if(options?.httpMetadata)await writeFile(name+'.json',JSON.stringify(options.httpMetadata));
      await writeFile(name,Buffer.from(data));
    },
    async get(key){
      const name=pathFor(key);
      let data;
      try{data=await readFile(name)}catch(error){if(error.code==='ENOENT')return null;throw error}
      const meta=await readFile(name+'.json','utf8').catch(error=>{if(error.code==='ENOENT')return '{}';throw error});
      return {body:data,httpMetadata:JSON.parse(meta)};
    },
    async delete(keys){
      await Promise.all([keys].flat().flatMap(key=>[pathFor(key),pathFor(key)+'.json']).map(file=>rm(file,{force:true})));
    },
  },
};
