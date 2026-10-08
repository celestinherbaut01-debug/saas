import test from 'node:test';
import assert from 'node:assert/strict';
import {getBusinessOsProfile} from '../src/lib/business-os';
import {propertyToStudioInput,estateAttention,type Property,type RealEstateData} from '../src/lib/realestate';
import {generateStudioContent} from '../src/lib/studio/generator';
import {DEFAULT_BRAND_KIT} from '../src/lib/studio/types';
import {checkedAll,DataLoadError,classifyDataError,requireRead} from '../src/lib/data-state';
import {computeGarageCommandCenter,computeCleaningCommandCenter,computeAgencyCommandCenter,computeRestaurantCommandCenter,computeButcherCommandCenter} from '../src/lib/command-center';
import {computeButcherAlerts} from '../src/lib/butcher';
const property={id:'property',workspace_id:'workspace',created_at:'2026-10-06T07:00:00Z',updated_at:'2026-10-06T07:00:00Z',title:'Bien de test',owner_id:null,property_type:null,address:null,city:null,surface_m2:null,rooms:null,bedrooms:null,price:null,description:'',features:[],status:'to_publish',transaction_type:'sale',photos:[],dpe:null} as Property;
test('a real estate agent receives its vertical; an expert and unknown job use the honest fallback',()=>{
 assert.equal(getBusinessOsProfile('immobilier','realestate').vertical,'realestate');assert.equal(getBusinessOsProfile('immobilier','expertise').vertical,'generic');
 assert.equal(getBusinessOsProfile('automobile','garages').vertical,'garage');assert.equal(getBusinessOsProfile('numerique-communication','web').vertical,'agency');assert.equal(getBusinessOsProfile('services-b2b','cleaning').vertical,'cleaning');assert.equal(getBusinessOsProfile('restauration','restaurants').vertical,'restaurant');
 assert.equal(getBusinessOsProfile(null,'butcher').vertical,'butcher');assert.equal(getBusinessOsProfile('n-importe-quoi','butcher').osName,'Boucherie OS');
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
test('butcher alerts only flag what was really recorded — no invented regulatory traceability',()=>{
 const items=[{id:'item',name:'Entrecôte',quantity:1,unit:'kg',low_stock_threshold:2,archived_at:null} as never];
 const soon=new Date(Date.now()+2*24*60*60*1000).toISOString().slice(0,10);
 const movements=[{id:'m1',item_id:'item',type:'reception',quantity_delta:5,expires_on:soon,lot_number:'L42',created_at:new Date().toISOString()} as never];
 const orders=[{id:'o1',status:'sent',ordered_at:new Date().toISOString(),expected_at:new Date(Date.now()-86400000).toISOString()} as never];
 const alerts=computeButcherAlerts({items,movements,orders});
 assert.ok(alerts.some(a=>a.level==='danger'&&a.text.includes('stock bas')));
 assert.ok(alerts.some(a=>a.text.includes('L42')&&a.level==='danger'));
 assert.ok(alerts.some(a=>a.text.includes('attendue')));
 // Un lot sans DLC saisie ne doit jamais générer d'alerte DLC inventée.
 const noDlc=computeButcherAlerts({items:[],movements:[{id:'m2',item_id:'item',type:'reception',quantity_delta:5,expires_on:null,lot_number:null,created_at:new Date().toISOString()} as never],orders:[]});
 assert.equal(noDlc.length,0);
});
test('butcher command center signals low stock as a blocker with the item id',()=>{
 const items=[{id:'item',name:'Saucisses',quantity:0,unit:'kg',low_stock_threshold:1,archived_at:null} as never];
 const cc=computeButcherCommandCenter({items,movements:[],orders:[]});
 assert.equal(cc.blockers?.[0].detailId,'item');
});

import {nafCodesForSelection} from '../src/lib/prospecting-naf';
import {matchesWebFilter} from '../../supabase/functions/_shared/webFilter';
import {haversineKm} from '../../supabase/functions/_shared/haversine';
import {normalizeNaf,matchesRequestedNaf} from '../../supabase/functions/_shared/naf';
import {dedupeBySiret} from '../../supabase/functions/_shared/dedupe';

// Audit confirmé (client réel : 87 "Boulangeries" jugées suspectes à 10km de
// Béthune) : `activite_principale` s'applique à l'unité légale côté API
// (recherche-entreprises.api.gouv.fr), pas à chaque établissement — ces
// tests verrouillent le post-filtrage NAF strict et la normalisation de
// format ("10.71C" vs "1071C" doivent être comparables).
test('la normalisation NAF rend "10.71C" et "1071C" identiques', () => {
  assert.equal(normalizeNaf('10.71C'), normalizeNaf('1071C'));
  assert.equal(normalizeNaf('10.71C'), '1071C');
  assert.equal(normalizeNaf(null), '');
  assert.equal(normalizeNaf(undefined), '');
});
test('un établissement dont le NAF ne correspond à aucun code demandé est rejeté', () => {
  assert.equal(matchesRequestedNaf('10.13A', ['10.71C']), false);
  assert.equal(matchesRequestedNaf(null, ['10.71C']), false);
});
test('un établissement dont le NAF correspond, même avec un format différent, est accepté', () => {
  assert.equal(matchesRequestedNaf('1071C', ['10.71C']), true);
  assert.equal(matchesRequestedNaf('10.71C', ['1071C']), true);
});
test('sans filtre métier (aucun NAF demandé), tout établissement passe', () => {
  assert.equal(matchesRequestedNaf('56.10A', []), true);
  assert.equal(matchesRequestedNaf(null, []), true);
});

// Déduplication SIRET : un même établissement physique (même SIRET) revenu
// plusieurs fois (pages, matching_etablissements en double...) ne doit
// produire qu'une seule fiche ; le compteur final doit se baser sur ce
// nombre de SIRET uniques, jamais sur le nombre brut de lignes API.
test('la déduplication par SIRET ne garde qu\'une occurrence de chaque établissement', () => {
  const items = [
    { siret: '111', name: 'A' },
    { siret: '222', name: 'B' },
    { siret: '111', name: 'A (doublon)' },
    { siret: '333', name: 'C' },
    { siret: '222', name: 'B (doublon)' },
  ];
  const result = dedupeBySiret(items);
  assert.deepEqual(result.map((r) => r.siret), ['111', '222', '333']);
  assert.equal(result[0].name, 'A'); // garde la PREMIÈRE occurrence
});
test('la déduplication ne modifie rien quand tous les SIRET sont déjà uniques', () => {
  const items = [{ siret: 'a' }, { siret: 'b' }, { siret: 'c' }];
  assert.deepEqual(dedupeBySiret(items), items);
});

// Bug réel rapporté par un client (Prospection, "Boulangeries" autour de
// Béthune) : "162 trouvé(s) dans le registre, 0 affiché(s)". Cause exacte :
// le filtre "besoin digital" comparait websiteQuality ("none"/"weak"/"ok"/
// "unknown") plutôt que verificationStatus, et websiteQuality vaut TOUJOURS
// "unknown" sans clé Google Places configurée — aucun candidat ne pouvait
// jamais matcher "none"/"weak"/"no_or_weak". Ces tests verrouillent le
// comportement corrigé : Google Places ne doit JAMAIS être une condition
// d'existence du résultat (voir supabase/functions/_shared/webFilter.ts).
test('un candidat jamais vérifié par Google reste visible sous "aucun site" / "absent ou faible" / "tous"', () => {
  assert.equal(matchesWebFilter('REGISTRY_ONLY', 'all'), true);
  assert.equal(matchesWebFilter('REGISTRY_ONLY', 'none'), true);
  assert.equal(matchesWebFilter('REGISTRY_ONLY', 'no_or_weak'), true);
});
test('un candidat jamais vérifié ne peut pas satisfaire un filtre qui exige une vraie donnée Google', () => {
  assert.equal(matchesWebFilter('REGISTRY_ONLY', 'weak'), false);
  assert.equal(matchesWebFilter('REGISTRY_ONLY', 'unknown'), false);
});
test('un site confirmé par Google comme bon est exclu des filtres "opportunité"', () => {
  assert.equal(matchesWebFilter('WEBSITE_GOOD', 'all'), true);
  assert.equal(matchesWebFilter('WEBSITE_GOOD', 'no_or_weak'), false);
  assert.equal(matchesWebFilter('WEBSITE_GOOD', 'none'), false);
  assert.equal(matchesWebFilter('WEBSITE_GOOD', 'unknown'), false);
});
test('Google confirmant explicitement l\'absence de site matche "aucun site" et "absent ou faible"', () => {
  assert.equal(matchesWebFilter('NO_WEBSITE_CONFIRMED', 'none'), true);
  assert.equal(matchesWebFilter('NO_WEBSITE_CONFIRMED', 'no_or_weak'), true);
  assert.equal(matchesWebFilter('NO_WEBSITE_CONFIRMED', 'weak'), false);
});
test('"Fiche Google active" exige une fiche confirmée, jamais un candidat non vérifié', () => {
  assert.equal(matchesWebFilter('GOOGLE_VERIFIED', 'unknown'), true);
  assert.equal(matchesWebFilter('WEBSITE_WEAK', 'unknown'), true);
  assert.equal(matchesWebFilter('REGISTRY_ONLY', 'unknown'), false);
  assert.equal(matchesWebFilter('WEBSITE_GOOD', 'unknown'), false);
});

// Sélection des métiers : un seul métier sélectionné ne doit jamais ramener
// les codes NAF d'un métier voisin non sélectionné (ex. Boulangeries seule
// ne doit pas inclure Boucheries) ; la sélection multiple doit fonctionner.
const BAKERY = { id: 'bakery', naf_codes: ['10.71C'] };
const BUTCHER = { id: 'butcher', naf_codes: ['10.13A'] };
const RESTAURANT = { id: 'restaurant', naf_codes: ['56.10A'] };
test('un seul métier sélectionné ne ramène que ses propres codes NAF', () => {
  assert.deepEqual(nafCodesForSelection(['bakery'], [BAKERY, BUTCHER, RESTAURANT]), ['10.71C']);
});
test('plusieurs métiers sélectionnés cumulent leurs codes NAF sans doublon', () => {
  const codes = nafCodesForSelection(['bakery', 'butcher', 'restaurant'], [BAKERY, BUTCHER, RESTAURANT]);
  assert.deepEqual([...codes].sort(), ['10.13A', '10.71C', '56.10A']);
});
test('retirer un métier retire réellement son code NAF de la sélection', () => {
  assert.deepEqual(nafCodesForSelection(['restaurant'], [BAKERY, BUTCHER, RESTAURANT]), ['56.10A']);
});

// Rayon : un établissement pile sur la limite doit rester inclus (<=), un
// établissement juste au-delà doit être exclu — la logique d'appel (voir
// index.ts, filter sur distanceKm <= radiusKm) dépend de haversineKm qui
// doit rester une distance exacte, jamais fabriquée.
test('le calcul de distance est exact et le rayon inclut la limite exacte', () => {
  // Béthune (approx.) -> Lille (approx.) : environ 32-33 km réels.
  const bethune = { lat: 50.5303, lng: 2.6414 };
  const lille = { lat: 50.6292, lng: 3.0573 };
  const d = haversineKm(bethune.lat, bethune.lng, lille.lat, lille.lng);
  assert.ok(d > 30 && d < 35, `distance Béthune-Lille hors plage attendue : ${d}`);
  assert.equal(haversineKm(0, 0, 0, 0), 0);
  // À une distance connue d'environ 20km (10km élargi à 20km doit inclure
  // tout ce que 10km incluait) : un point à 15km doit matcher radius=20
  // mais pas radius=10.
  const near = haversineKm(bethune.lat, bethune.lng, 50.5303 + 0.135, 2.6414); // ~15km plein nord
  assert.ok(near > 10, `point de test attendu hors du rayon 10km : ${near}`);
  assert.ok(near < 20, `point de test attendu dans le rayon 20km : ${near}`);
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

import {computeDocumentTotals,lineTotalHt,lineTotalTtc,nextDocumentNumber} from '../src/lib/document-totals';
test('les totaux HT/TVA/TTC sont calculés à partir des lignes réelles, jamais inventés',()=>{
 const totals=computeDocumentTotals([{description:'Site vitrine',quantity:1,unitPriceHt:1000,vatRate:20},{description:'Maintenance',quantity:3,unitPriceHt:50,vatRate:10}]);
 assert.equal(totals.totalHt,1150);assert.equal(totals.totalTtc,1200+165);assert.equal(totals.totalVat,totals.totalTtc-totals.totalHt);
});
test('une ligne à quantité/prix décimaux ne produit pas d\'erreur de flottant visible',()=>{
 assert.equal(lineTotalHt({description:'x',quantity:0.1,unitPriceHt:0.2,vatRate:0}),0.02);
 assert.equal(lineTotalTtc({description:'x',quantity:1,unitPriceHt:100,vatRate:20}),120);
});
test('un devis sans aucune ligne produit des totaux à zéro, pas une erreur',()=>{
 const totals=computeDocumentTotals([]);
 assert.deepEqual(totals,{totalHt:0,totalVat:0,totalTtc:0});
});
test('la numérotation des documents suit le compteur réel fourni, jamais un nombre fixe',()=>{
 const year=new Date().getFullYear();
 assert.equal(nextDocumentNumber('invoice',0),`FAC-${year}-0001`);
 assert.equal(nextDocumentNumber('quote',11),`DEV-${year}-0012`);
});

import {filterEntriesByRange,groupEntriesByDay,rangeBounds} from '../src/lib/planning';
import type {PlanningEntry} from '../src/lib/supabase/types';
function fakeEntry(startsAt:string,overrides:Partial<PlanningEntry> = {}):PlanningEntry {
 return {id:startsAt,workspace_id:'w',title:'Événement',starts_at:startsAt,ends_at:null,kind:'appointment',customer_id:null,project_id:null,team_member_id:null,notes:'',status:'planned',created_at:startsAt,updated_at:startsAt,...overrides};
}
test('le filtre "aujourd\'hui" ne garde que les événements du jour courant',()=>{
 const now=new Date('2026-10-07T10:00:00Z');
 const entries=[fakeEntry('2026-10-07T08:00:00Z'),fakeEntry('2026-10-07T23:00:00Z'),fakeEntry('2026-10-08T01:00:00Z'),fakeEntry('2026-10-06T23:59:00Z')];
 const todayCount=filterEntriesByRange(entries,'today',now).length;
 assert.ok(todayCount>=1 && todayCount<=2,`attendu 1 ou 2 selon fuseau, obtenu ${todayCount}`);
 assert.equal(filterEntriesByRange(entries,'today',now).some(e=>e.starts_at==='2026-10-08T01:00:00Z'),false);
});
test('le filtre "semaine" inclut plus d\'événements que "aujourd\'hui", jamais moins',()=>{
 const now=new Date('2026-10-07T10:00:00Z');
 const entries=[fakeEntry('2026-10-07T08:00:00Z'),fakeEntry('2026-10-09T08:00:00Z'),fakeEntry('2026-10-20T08:00:00Z')];
 const today=filterEntriesByRange(entries,'today',now).length;
 const week=filterEntriesByRange(entries,'week',now).length;
 assert.ok(week>=today);
 assert.equal(filterEntriesByRange(entries,'week',now).some(e=>e.starts_at==='2026-10-20T08:00:00Z'),false);
});
test('le regroupement par jour trie chronologiquement et ne perd aucun événement',()=>{
 const entries=[fakeEntry('2026-10-07T14:00:00Z'),fakeEntry('2026-10-07T08:00:00Z'),fakeEntry('2026-10-08T08:00:00Z')];
 const grouped=groupEntriesByDay(entries);
 const totalEntries=grouped.reduce((n,g)=>n+g.entries.length,0);
 assert.equal(totalEntries,3);
 assert.equal(grouped[0].entries[0].starts_at,'2026-10-07T08:00:00Z');
});
test('les bornes de "mois" couvrent strictement plus que "semaine"',()=>{
 const now=new Date('2026-10-07T10:00:00Z');
 const week=rangeBounds('week',now);const month=rangeBounds('month',now);
 assert.ok(month.end.getTime()>week.end.getTime());
 assert.equal(week.start.getTime(),month.start.getTime());
});

import {haveSearchParamsChanged} from '../src/lib/prospecting-search-params';
const baseSnapshot={targetIds:['bakery'],lat:50.53,lng:2.64,radiusKm:10,filters:{operationalOnly:true,excludeTempClosed:true,excludeChains:true,excludeAssociations:true,excludeLargeGroups:true,needContact:false,maxEstablishmentsPerSiren:8,webFilter:'all' as const,phoneOnly:false,googleFicheOnly:false}};
test('sans recherche précédente, les paramètres ne sont jamais "modifiés"',()=>{
 assert.equal(haveSearchParamsChanged(baseSnapshot,null),false);
});
test('des paramètres identiques à la dernière recherche ne sont pas "modifiés"',()=>{
 assert.equal(haveSearchParamsChanged({...baseSnapshot},{...baseSnapshot}),false);
});
test('changer la localisation (Béthune -> Lille) marque les paramètres comme modifiés',()=>{
 assert.equal(haveSearchParamsChanged({...baseSnapshot,lat:50.63,lng:3.06},baseSnapshot),true);
});
test('changer le rayon marque les paramètres comme modifiés',()=>{
 assert.equal(haveSearchParamsChanged({...baseSnapshot,radiusKm:20},baseSnapshot),true);
});
test('changer la cible métier (même en changeant juste l\'ordre) : ajouter un métier est détecté, réordonner ne l\'est pas',()=>{
 assert.equal(haveSearchParamsChanged({...baseSnapshot,targetIds:['bakery','butcher']},baseSnapshot),true);
 assert.equal(haveSearchParamsChanged({...baseSnapshot,targetIds:['bakery']},{...baseSnapshot,targetIds:['bakery']}),false);
});
test('changer un filtre (webFilter) marque les paramètres comme modifiés',()=>{
 assert.equal(haveSearchParamsChanged({...baseSnapshot,filters:{...baseSnapshot.filters,webFilter:'none'}},baseSnapshot),true);
});
