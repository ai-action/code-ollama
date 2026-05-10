import { AUTO, PLAN, SAFE } from '../constants/mode';

export type Mode = typeof SAFE | typeof AUTO | typeof PLAN;
