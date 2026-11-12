import {readFile, rename, rm, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {MongoClient} from 'mongodb';

async function configure(){
  if(!process.stdin.isTTY || !process.stdout.isTTY){
    throw new Error('Run npm run setup:mongodb in an interactive terminal.');
  }
  const file=new URL('../.env',import.meta.url);
  const old=await readFile(file,'utf8').catch(error=>{
    if(error.code==='ENOENT')return '';
    throw error;
  });
  let hidden=false;
  const output=new Writable({write(chunk,encoding,done){
    if(!hidden)process.stdout.write(chunk,encoding);
    done();
  }});
  const input=createInterface({input:process.stdin,output,terminal:true,historySize:0});
  let database,uri;
  try{
    database=(await input.question('Database name (Enter for project_record): ')).trim()||'project_record';
    if(!/^[\p{L}\p{N}_-]{1,63}$/u.test(database)||Buffer.byteLength(database)>=64){
      throw new Error('Use the database name shown in Compass (letters, numbers, underscores or hyphens).');
    }
    process.stdout.write('Paste the complete MongoDB connection string (input is hidden), then press Enter: ');
    hidden=true;
    uri=(await input.question('')).trim();
  }finally{
    input.close();
    if(hidden)process.stdout.write('\n');
  }
  if(!/^mongodb(?:\+srv)?:\/\/[^\s#"'<>]+$/i.test(uri)){
    throw new Error('Paste a complete MongoDB connection string with the password filled in and any special characters URL-encoded.');
  }
  let client;
  try{
    client=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
    await client.connect();
    await client.db(database).command({ping:1});
  }catch{
    throw new Error('Could not connect to MongoDB. Try the same connection in Compass and check the database password and Atlas IP access.');
  }finally{
    if(client)await client.close().catch(()=>{});
  }
  const retained=old.replace(/^\s*(?:export\s+)?MONGODB_(?:URI|DB)\s*=.*$/gm,'').trimEnd();
  const next=(retained?retained+'\n':'')+'MONGODB_URI='+uri+'\nMONGODB_DB='+database+'\n';
  const temp=new URL('../.env.setup-'+randomUUID(),import.meta.url);
  try{
    await writeFile(temp,next,{mode:0o600,flag:'wx'});
    await rename(temp,file);
  }finally{
    await rm(temp,{force:true}).catch(()=>{});
  }
  console.log('MongoDB connection verified and .env saved. Run npm start to open Project Record.');
}

configure().catch(error=>{
  console.error(error instanceof Error && /^(Run |Use |Paste |Could not connect)/.test(error.message)
    ?error.message:'Could not save the local MongoDB configuration.');
  process.exitCode=1;
});
