import test from 'node:test';
import assert from 'node:assert/strict';
import {getBusinessOsProfile} from '../src/lib/business-os';
import {propertyToStudioInput,estateAttention,type Property,type RealEstateData} from '../src/lib/realestate';
import {generateStudioContent} from '../src/lib/studio/generator';
import {DEFAULT_BRAND_KIT} from '../src/lib/studio/types';
import {checkedAll,DataLoadError,classifyDataError,requireRead} from '../src/lib/data-state';
import {computeGarageCommandCenter,computeCleaningCommandCenter,computeAgencyCommandCenter,computeRestaurantCommandCenter} from '../src/lib/command-center';
const property={id:'property',workspace_id:'workspace',created_at:'2026-10-06T07:00:00Z',updated_at:'2026-10-06T07:00:00Z',title:'Bien de test',owner_id:null,property_type:null,address:null,city:null,surface_m2:null,rooms:null,bedrooms:null,price:null,description:'',features:[],status:'to_publish',transaction_type:'sale',photos:[],dpe:null} as Property;
test('a real estate agent receives its vertical; an expert and unknown job use the honest fallback',()=>{
 assert.equal(getBusinessOsProfile('immobilier','realestate').vertical,'realestate');assert.equal(getBusinessOsProfile('immobilier','expertise').vertical,'generic');
 assert.equal(getBusinessOsProfile('automobile','garages').vertical,'garage');assert.equal(getBusinessOsProfile('numerique-communication','web').vertical,'agency');assert.equal(getBusinessOsProfile('services-b2b','cleaning').vertical,'cleaning');assert.equal(getBusinessOsProfile('restauration','restaurants').vertical,'restaurant');
});
test('unfilled property fields are never inferred in five channel outputs',()=>{
 const input=propertyToStudioInput(property);assert.equal(input.price,null);assert.equal(input.surfaceM2,null);assert.deepEqual(input.highlights,[]);
 const output=generateStudioContent({input,offerType:'bien',vertical:'realestate',brandKit:DEFAULT_BRAND_KIT,companyName:'Test',city:null});
 const text=JSON.stringify(output);assert.ok(!text.includes('m²'));assert.ok(!text.includes('€'));assert.ok(!text.includes('DPE'));assert.equal(output.email.subject,'Bien de test');assert.ok(output.sms.includes('Demandez une visite'));
});
test('known property values including zero remain exact and rent is labelled',()=>{
 const input=propertyToStudioInput({...property,price:0,rooms:0,surface_m2:42.5,transaction_type:'rent',address:'Adresse de test',features:['Terrasse']});
 assert.equal(input.price,'0 € / mois');assert.equal(input.rooms,0);assert.equal(input.surfaceM2,42.5);assert.deepEqual(input.highlights,['Terrasse']);assert.equal(input.neighborhood,'Adresse de test');
});
test('empty results and failed reads are distinct; a failed tuple cannot become an empty list',async()=>{
 const rows=await checkedAll([Promise.resolve({data:[],error:null})]);assert.deepEqual(rows[0].data,[]);
 await assert.rejects(()=>checkedAll([Promise.resolve({data:null,error:{code:'42501'}})]),e=>e instanceof DataLoadError&&e.kind==='permission');
 assert.throws(()=>requireRead({data:null,error:{code:'42P01'}}),DataLoadError);assert.equal(classifyDataError({status:503}),'network');assert.equal(classifyDataError({code:'PGRST205'}),'schema');
});
test('estate today is determined in France even near midnight UTC',()=>{
 const data:RealEstateData={owners:[],properties:[property],mandates:[],buyers:[],visits:[{id:'visit',workspace_id:'workspace',created_at:'',updated_at:'',property_id:'property',buyer_id:'buyer',starts_at:'2026-10-05T23:30:00Z',status:'planned',report:''}],offers:[]};
 const a=estateAttention(data,new Date('2026-10-06T08:00:00Z'));assert.equal(a.visits.length,1);assert.equal(a.unpublished[0].id,'property');assert.equal(a.pending.length,0);
});
test('all four command centers preserve object references and signal genuine blockers',()=>{
 const garage=computeGarageCommandCenter({repairOrders:[{id:'order',title:'Test',status:'waiting_parts',vehicle_id:'vehicle',customer_id:null,created_at:new Date().toISOString()}] as never,documents:[],customers:[],vehicles:[{id:'vehicle',registration:'TEST',customer_id:null}]});assert.equal(garage.blockers?.[0].detailId,'order');
 const cleaning=computeCleaningCommandCenter({interventions:[{id:'intervention',scheduled_at:new Date().toISOString(),status:'planned',team_member_id:null}] as never,incidents:[],contracts:[]});assert.equal(cleaning.blockers?.[0].detailId,'intervention');
 const agency=computeAgencyCommandCenter({sites:[],projects:[],tickets:[],documents:[],tasks:[{id:'task',title:'Test',blocked:true,done:false}] as never});assert.ok(agency.actions.some(a=>a.tab==='production'&&a.priority===3));
 const restaurant=computeRestaurantCommandCenter({appointments:[],purchaseOrders:[],inventory:[{id:'ingredient',name:'Test',quantity:2,unit:'kg',low_stock_threshold:3}] as never});assert.equal(restaurant.blockers?.[0].detailId,'ingredient');
});

import {GARAGE_NEXT_STATUS,garageWorkshopStage} from '../src/lib/garage-workflow';
import type {RepairOrder} from '../src/lib/supabase/types';
test('workshop chain preserves validation, blocking, readiness and delivery',()=>{
 let stage:RepairOrder['status']='diagnostic';const sequence:RepairOrder["status"][]=[stage];
 while(GARAGE_NEXT_STATUS[stage]){stage=GARAGE_NEXT_STATUS[stage]!;sequence.push(stage);}
 assert.deepEqual(sequence,['diagnostic','quote','accepted','in_progress','done','delivered']);assert.equal(GARAGE_NEXT_STATUS.waiting_parts,'in_progress');
 assert.equal(garageWorkshopStage({status:'diagnostic',scheduled_at:'2026-10-07T10:00:00Z'} as RepairOrder,new Date('2026-10-06T10:00:00Z')),'upcoming');
 assert.equal(garageWorkshopStage({status:'diagnostic',scheduled_at:'2026-10-05T10:00:00Z'} as RepairOrder,new Date('2026-10-06T10:00:00Z')),'diagnostic');
});
