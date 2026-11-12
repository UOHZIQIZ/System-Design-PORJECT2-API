import {MongoClient} from 'mongodb';

export async function connectDatabase(){
  const uri=process.env.MONGODB_URI?.trim();
  if(!uri)throw new Error('MONGODB_URI is required. Set it in .env or in the hosting environment.');
  const client=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
  try{
    await client.connect();
    const database=client.db(process.env.MONGODB_DB?.trim()||'project_record');
    await database.command({ping:1});
    return {client,collection:database.collection('projects')};
  }catch{
    await client.close().catch(()=>{});
    throw new Error('Could not connect to MongoDB. Check the URI, database credentials, and network access.');
  }
}
