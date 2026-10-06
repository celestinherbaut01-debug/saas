// Exercises the compiled Next application and its actual server actions with an isolated API fixture.
// This is HTTP integration coverage, not a browser or live Supabase/RLS test.
import {createClient} from '@supabase/supabase-js';
import {convertWonProspectToCustomer} from '../src/lib/crm-conversion.ts';
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const base=process.env.V4_TEST_URL??'http://127.0.0.1:3010',api='http://127.0.0.1:54329',ws='00000000-0000-4000-8000-000000000001';
const session=await fetch(api+'/fixture/session').then(r=>r.json());
const cookie='sb-127-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
const manifest=JSON.parse(await readFile('.next/server/server-reference-manifest.json','utf8'));
const actionId=name=>Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];
async function state(){return fetch(api+'/fixture/state').then(r=>r.json());}
async function seed(data){const r=await fetch(api+'/fixture/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200);}
async function page(path){const r=await fetch(base+path,{headers:{Cookie:cookie}});assert.equal(r.status,200,path);const html=await r.text();assert.ok(!html.includes('Application error:'),path);return html;}
async function action(name,args,path='/business-os'){
 assert.ok(actionId(name),'action registered: '+name);
 const r=await fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:base,'Next-Action':actionId(name),'Content-Type':'text/plain;charset=UTF-8',Accept:'text/x-component'},body:JSON.stringify(args)});
 const text=await r.text();assert.equal(r.status,200,`${name}: ${text.slice(0,300)}`);assert.ok(!text.includes('"digest"'),name);return text;
}
const report=[];
for(const path of ['/','/tarifs','/dashboard','/prospection','/crm','/studio','/business-os','/missions','/nova/actions','/analytics','/abonnement']){await page(path);report.push(`HTTP 200 ${path}`);}
for(const [vertical,heading] of [['garages','Garage OS'],['web','Agency OS'],['cleaning','Nettoyage OS'],['restaurants','Restaurant OS'],['realestate','Immobilier OS']]){await seed({vertical});const html=await page('/business-os');assert.ok(html.includes(heading),vertical);report.push(`vertical SSR + empty state: ${vertical}`);}
const estate=async(entity,id,input)=>action('saveEstateEntity',[ws,entity,id,input]);
await estate('owners',null,{name:'Propriétaire de test',email:'owner@example.test'});const owner=(await state()).property_owners.at(-1);
await estate('properties',null,{title:'Bien de test intégration',owner_id:owner.id,price:215000,surface_m2:72,rooms:3,bedrooms:2,address:'Adresse de test',city:'Lille',description:'Description fournie',features:['Terrasse'],status:'to_publish',transaction_type:'sale'});const property=(await state()).properties.at(-1);assert.equal(property.owner_id,owner.id);
await estate('buyers',null,{name:'Acquéreur de test',budget:230000,interested_property_ids:[property.id]});const buyer=(await state()).property_buyers.at(-1);
await estate('mandates',null,{property_id:property.id,owner_id:owner.id,mandate_type:'exclusive',starts_on:'2026-10-06',expires_on:'2027-04-06',status:'active'});
await estate('visits',null,{property_id:property.id,buyer_id:buyer.id,starts_at:'2026-10-07T12:00:00Z',status:'planned',report:''});
await estate('offers',null,{property_id:property.id,buyer_id:buyer.id,amount:210000,status:'pending',notes:''});
assert.equal((await state()).property_visits.at(-1).buyer_id,buyer.id);assert.equal((await state()).property_offers.at(-1).amount,210000);
await estate('properties',property.id,{price:220000});assert.equal((await state()).properties.at(-1).price,220000);
assert.ok((await page('/business-os?propertyId='+property.id)).includes('Bien de test intégration'));
const studio=await page('/studio?propertyId='+property.id);assert.ok(studio.includes('Bien de test intégration'));assert.ok(studio.includes('72'));assert.ok(studio.includes('Terrasse'));
await action('createStudioCreation',[ws,{vertical:'realestate',offerType:'bien',sourcePropertyId:property.id,input:{title:'Incorrect client title',description:'Invented client description'}}],'/studio');
let creation=(await state()).studio_creations.at(-1);assert.equal(creation.title,'Bien de test intégration');assert.equal(creation.input_data.price,'220 000 €');assert.ok(!JSON.stringify(creation.generated_content).includes('Invented client description'));
for(const k of ['instagram','facebook','email','site','sms'])assert.ok(creation.generated_content[k]);assert.ok((await page('/studio')).includes('Bien de test intégration'));
report.push('estate owner → property → mandate → visit → offer → studio prefill → five channels → persisted library; property edit');
const counts=(await state()).property_owners.length;
const denial=await action('saveEstateEntity',['00000000-0000-4000-8000-000000000999','owners',null,{name:'Wrong workspace'}]);assert.ok(denial.includes('refus'));assert.equal((await state()).property_owners.length,counts);report.push('server action rejects inaccessible workspace');
for(const [code,status,expected] of [['42501',403,'Accès aux données refusé'],['42P01',400,'Mise à jour des données nécessaire'],['NETWORK',503,'Données temporairement indisponibles']]){
 await seed({failure:{table:'properties',code,status}});const html=await page('/business-os');assert.ok(html.includes(expected),code);assert.ok(!html.includes('Aucun enregistrement dans biens'));report.push('classified read error: '+code);
}
await seed({failure:null});
const db=createClient(api,'fixture-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${session.access_token}`}}});
const prospect={id:'00000000-0000-4000-8000-000000000888',workspace_id:ws,company_name:'Prospect de test gagné',status:'new',phone:null,converted_customer_id:null,quality_score:80,city:'Lille',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
await seed({table:'prospects',rows:[prospect]});await db.from('prospects').update({status:'won'}).eq('id',prospect.id);
const [first,second]=await Promise.all([convertWonProspectToCustomer(db,{...prospect,status:'won'}),convertWonProspectToCustomer(db,{...prospect,status:'won'})]);
assert.equal(first,second);assert.equal((await state()).customers.filter(c=>c.name===prospect.company_name).length,1);
assert.ok((await page('/crm')).includes('Prospect de test gagné'));report.push('CRM won → real conversion helper → one customer after concurrent calls (fixture RPC, not live database transaction)');
await seed({vertical:'garages'});await seed({table:'repair_orders',rows:[{id:'00000000-0000-4000-8000-000000000777',workspace_id:ws,title:'Réparation de test',status:'diagnostic',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),vehicle_id:null,customer_id:null,technician_id:null,scheduled_at:null,completed_at:null,delivered_at:null,archived_at:null,labor_cost:0,parts_cost:0,notes:''}]});
for(const status of ['quote','accepted','waiting_parts','in_progress','done','delivered']){const result=await db.from('repair_orders').update({status}).eq('id','00000000-0000-4000-8000-000000000777');assert.equal(result.error,null);assert.equal((await state()).repair_orders[0].status,status);await page('/business-os');}
report.push('garage status persistence across six stages via API and SSR reload (no UI clicks)');
console.log(JSON.stringify({mode:'HTTP integration / isolated fixture',passed:report},null,2));
