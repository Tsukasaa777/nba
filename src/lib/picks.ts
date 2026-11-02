import { z } from 'zod';
import type { Selection } from './types';
export const pickSchema=z.object({id:z.uuid(),created_at:z.iso.datetime(),player_id:z.string().max(60),player_name:z.string().max(100),game_id:z.string().max(60),game_label:z.string().max(120),market:z.enum(['pts','reb','ast','fg3m','stl','blk','turnover','pr','pa','ra','pra']),side:z.enum(['over','under']),line:z.number().min(0).max(300),odds:z.number().min(1.001).max(10000).nullable(),probability:z.number().min(0).max(1).nullable(),projection:z.number().nullable(),model_version:z.string().max(100),sample_size:z.number().int().nonnegative(),notes:z.string().max(2000),actual:z.number().nonnegative().nullable(),outcome:z.enum(['pending','win','loss','push','void']),source_updated_at:z.string().nullable()});
export const PICK_KEY='propspro-iq:picks:v1';
export function readPicks():Selection[]{try{const r=z.array(pickSchema).max(500).safeParse(JSON.parse(localStorage.getItem(PICK_KEY)||'[]'));return r.success?r.data:[];}catch{return [];}}
export function writePicks(picks:Selection[]){const r=z.array(pickSchema).max(500).parse(picks);localStorage.setItem(PICK_KEY,JSON.stringify(r));}
