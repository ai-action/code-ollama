import { DECISION } from '../constants';

export type Decision = (typeof DECISION)[keyof typeof DECISION];
