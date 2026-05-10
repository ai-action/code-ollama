import { TOOL } from '../constants';

export type Tool = (typeof TOOL)[keyof typeof TOOL];
