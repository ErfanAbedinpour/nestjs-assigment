import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RandomSource } from '../application/ports/random-source';

const SCALE = 1_000_000;

@Injectable()
export class CryptoRandomSource extends RandomSource {
  override nextUnitInterval(): number {
    return this.nextInt(SCALE) / SCALE;
  }

  override nextInt(exclusiveUpper: number): number {
    return randomInt(0, exclusiveUpper);
  }
}
