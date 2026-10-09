const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname+'/../..';
const html=fs.readFileSync(root+'/cidian/index.html','utf8');
const script=/<script id="cidian-entry">([\s\S]*?)<\/script>/.exec(html)[1];
const version=/VERSION='([^']+)'/.exec(fs.readFileSync(root+'/cidian/app.js','utf8'))[1];
function open(href){
  const redirects=[];
  vm.runInNewContext(script,{URL,location:{href,replace:url=>redirects.push(url)},navigator:{onLine:false}});
  return redirects;
}
test('ordinary dictionary URLs reach the versioned entry without a manual query',()=>{
  for(const path of ['/cidian','/cidian/','/cidian/index.html']){
    const redirected=open('https://crmuro.ru'+path);
    assert.deepEqual(redirected,['https://crmuro.ru/cidian/?v='+version]);
  }
});
test('dictionary entry keeps query and fragment and replaces an old version',()=>{
  const redirected=open('https://crmuro.ru/cidian/index.html?filter=new&v=2.19.0#word');
  assert.equal(redirected.length,1);
  const url=new URL(redirected[0]);
  assert.equal(url.pathname,'/cidian/');assert.equal(url.searchParams.get('filter'),'new');
  assert.equal(url.searchParams.get('v'),version);assert.equal(url.hash,'#word');
});
test('versioned entry stops redirecting, including when loaded from an offline shell',()=>{
  const first=open('https://crmuro.ru/cidian/?filter=new#word')[0];
  assert.deepEqual(open(first),[]);
  assert.deepEqual(open('https://crmuro.ru/cidian/?v='+version),[]);
  assert.deepEqual(open('https://crmuro.ru/tingli/'),[]);
});
