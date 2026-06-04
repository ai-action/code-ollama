import { SCREEN } from '@/constants';

export type Screen = (typeof SCREEN)[keyof typeof SCREEN];
