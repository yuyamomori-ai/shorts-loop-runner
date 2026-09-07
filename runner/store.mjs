import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
import {initialState,migrateState} from '../lib/core.mjs';
export class Store {
 constructor(directory=process.env.DATA_DIR||'data'){
  this.directory=resolve(directory);mkdirSync(this.directory,{recursive:true,mode:0o700});
  this.db=new DatabaseSync(resolve(this.directory,'shorts-loop.sqlite'));
  this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS leases (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);');
  this.db.prepare('INSERT OR IGNORE INTO workspace(id,data) VALUES(1,?)').run(JSON.stringify(initialState()));
  try{chmodSync(resolve(this.directory,'shorts-loop.sqlite'),0o600);}catch{}
 }
 read(){return migrateState(JSON.parse(this.db.prepare('SELECT data FROM workspace WHERE id=1').get().data));}
 update(fn){this.db.exec('BEGIN IMMEDIATE');try{const s=this.read();const result=fn(s);this.db.prepare('UPDATE workspace SET data=?, revision=revision+1 WHERE id=1').run(JSON.stringify(s));this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 acquire(name,owner,seconds=3600){const t=Date.now();const r=this.db.prepare('INSERT INTO leases(name,owner,expires) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE leases.expires<?').run(name,owner,t+seconds*1000,t);return r.changes===1;}
 release(name,owner){this.db.prepare('DELETE FROM leases WHERE name=? AND owner=?').run(name,owner);}
 close(){this.db.close();}
}
