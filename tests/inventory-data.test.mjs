import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(await readFile(new URL('../cards.js',import.meta.url),'utf8'),context);
const cards=JSON.parse(JSON.stringify(context.window.CARDS));
const sales=JSON.parse(await readFile(new URL('../ventas-archivadas-2026-11-17.json',import.meta.url),'utf8'));
test('fully sold references stay outside the active inventory',()=>{
 const sold=new Set(sales.records.filter(c=>c.japaneseQuantityRetained===0).map(c=>c.id));
 assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
 for(const card of cards){
  assert.equal(sold.has(card.id),false,'Sold reference '+card.id);
  assert.equal(card.language,'Japonés');
  assert.ok(Number.isSafeInteger(card.quantity)&&card.quantity>0);
 }
 assert.equal(cards.length,sales.japaneseReferencesRetained);
 assert.equal(cards.reduce((sum,c)=>sum+c.quantity,0),sales.japaneseUnitsRetained);
});
test('partially sold references retain exactly their unsold Japanese units',()=>{
 for(const sale of sales.records.filter(c=>c.japaneseQuantityRetained>0)){
  const card=cards.find(c=>c.id===sale.id);
  assert.ok(card,'Missing retained reference '+sale.id);
  assert.equal(card.quantity,sale.japaneseQuantityRetained);
  assert.deepEqual(card.languageQuantities,{'Japonés':sale.japaneseQuantityRetained});
 }
});
