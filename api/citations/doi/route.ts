export async function GET(request: Request) {
  if (!request.headers.get('oai-authenticated-user-id')) return Response.json({error:'unauthorized'}, {status:401});
  const input = (new URL(request.url).searchParams.get('doi') ?? '').trim();
  const doi = input.replace(/^doi:\s*|^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  if (doi.length > 255 || !/^10\.\d{4,9}\/[^\s\u0000-\u001f]+$/i.test(doi)) return Response.json({error:'invalid'}, {status:400});
  try {
    const response = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), {
      headers:{Accept:'application/json'}, signal:AbortSignal.timeout(7000)
    });
    if (response.status === 404) return Response.json({error:'not_found'}, {status:404});
    if (!response.ok) return Response.json({error:'unavailable'}, {status:502});
    const {message:m} = await response.json() as {message?:Record<string,any>};
    if (!m?.title?.[0]) return Response.json({error:'not_found'}, {status:404});
    const str=(x:unknown)=>typeof x==='string'?x.trim():'';
    const year=(m.published ?? m.issued ?? m['published-print'] ?? m['published-online'])?.['date-parts']?.[0]?.[0];
    return Response.json({
      doi:str(m.DOI)||doi, title:str(m.title[0]), type:m.type==='book'||m.type==='monograph'?'book':'article',
      author:Array.isArray(m.author)?m.author.map((a:Record<string,unknown>)=>str(a.name)||[str(a.family),str(a.given).split(/\s+/).filter(Boolean).map(n=>n[0]+'.').join(' ')].filter(Boolean).join(', ')).filter(Boolean).join('; '):'',
      year:Number.isInteger(year)?String(year):'', journal:str(m['container-title']?.[0]), publisher:str(m.publisher),
      volume:str(m.volume), issue:str(m.issue), pages:str(m.page), url:'https://doi.org/'+(str(m.DOI)||doi)
    });
  } catch {
    return Response.json({error:'unavailable'}, {status:502});
  }
}
